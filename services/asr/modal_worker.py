"""Review-only deployment recipe. Running modal deploy provisions paid resources."""
import base64
import hmac
import io
import os
import wave
import modal
from fastapi import HTTPException, Request

app = modal.App("flowen-asr")
image = (modal.Image.from_registry("nvidia/cuda:12.3.2-cudnn9-runtime-ubuntu22.04", add_python="3.11")
         .pip_install("faster-whisper==1.2.1", "fastapi==0.142.2"))

@app.cls(image=image, gpu="L4", cpu=1, memory=4096, region="eu",
         min_containers=0, max_containers=1, scaledown_window=5, timeout=30,
         secrets=[modal.Secret.from_name("flowen-asr-worker")])
@modal.concurrent(max_inputs=1)
class Whisper:
    @modal.enter()
    def load(self):
        from faster_whisper import WhisperModel
        # Pre-download and bake a reviewed immutable model snapshot before production.
        model = os.environ.get("ASR_MODEL", "large-v3-turbo")
        if model not in ("large-v3-turbo", "distil-large-v3"):
            raise ValueError("Unsupported model")
        self.model_name = model
        self.model = WhisperModel(model, device="cuda", compute_type="float16")

    @modal.fastapi_endpoint(method="POST")
    async def transcribe(self, request: Request):
        key = os.environ.get("ASR_ENDPOINT_KEY", "")
        if len(key) < 32 or not hmac.compare_digest(request.headers.get("authorization", ""), "Bearer " + key):
            raise HTTPException(401, "Unauthorized")
        # Bound bytes before JSON decoding; never accept remote audio URLs.
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 4 * 1024 * 1024:
                raise HTTPException(413, "Payload too large")
        import json
        try:
            body = json.loads(raw)
            audio = base64.b64decode(body["audio"], validate=True)
            with wave.open(io.BytesIO(audio), "rb") as wav:
                duration = wav.getnframes() / wav.getframerate()
                if wav.getnchannels() != 1 or wav.getsampwidth() != 2 or not 8000 <= wav.getframerate() <= 48000 or not 0.5 <= duration <= 30:
                    raise ValueError("Invalid WAV")
            language = body.get("language", "en")
            if not isinstance(language, str) or len(language) != 2 or not language.isascii() or not language.isalpha():
                raise ValueError("Invalid language")
            if body.get("model") != self.model_name or (self.model_name == "distil-large-v3" and language != "en"):
                raise ValueError("Model mismatch")
            prompt = body.get("prompt", "")
            if not isinstance(prompt, str) or len(prompt) > 1000:
                raise ValueError("Invalid prompt")
        except (ValueError, KeyError, TypeError, wave.Error, ZeroDivisionError):
            raise HTTPException(400, "Invalid audio request")
        try:
            # No VAD or silence-removal stage; preserve repetition context.
            segments, _ = self.model.transcribe(io.BytesIO(audio), language=language,
                initial_prompt=prompt or None, vad_filter=False, condition_on_previous_text=False)
            text = "".join(segment.text for segment in segments).strip()
            if len(text) > 16000:
                raise ValueError("Transcript too large")
            return {"text": text}
        except Exception:
            raise HTTPException(502, "Transcription failed")
