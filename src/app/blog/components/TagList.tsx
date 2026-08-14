import Link from 'next/link';
import { slugify } from 'babylovegrowth-next-js-blog';
import { BLOG_BASE_PATH } from '../constants';

export function TagList({ keywords }: { keywords: string[] }) {
  const unique = Array.from(
    new Map(
      keywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .map((keyword) => [slugify(keyword), keyword] as const)
    ).entries()
  ).filter(([slug]) => slug.length > 0);

  if (unique.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {unique.map(([slug, label]) => (
        <Link
          key={slug}
          href={`${BLOG_BASE_PATH}/tag/${slug}`}
          className="rounded-full bg-gray-100 dark:bg-slate-800 px-3 py-1 text-xs font-medium text-gray-600 dark:text-slate-300 transition hover:bg-gray-200 dark:hover:bg-slate-700"
        >
          {label}
        </Link>
      ))}
    </div>
  );
}
