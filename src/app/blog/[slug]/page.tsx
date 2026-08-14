import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArticleJsonLd } from '../components/ArticleJsonLd';
import { TagList } from '../components/TagList';
import { BLOG_BASE_PATH, SITE_URL } from '../constants';
import { formatDate } from '../format';
import { blog } from '../lib/blog-client';
import '../blog-content.css';

// Do not pre-render article pages at build time — the BabyLoveGrowth API
// rate-limits at 2 req/s and parallel SSG across many articles triggers 429s.
// ISR (revalidate 24 h) serves pages on first request then caches them.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await blog.getArticleBySlug(slug);
  if (!article) {
    return {};
  }
  const canonical = SITE_URL ? `${SITE_URL}${BLOG_BASE_PATH}/${article.slug}` : undefined;
  return {
    title: article.title,
    description: article.meta_description,
    alternates: canonical ? { canonical } : undefined,
    openGraph: {
      type: 'article',
      title: article.title,
      description: article.meta_description,
      url: canonical,
      images: article.hero_image_url ? [{ url: article.hero_image_url }] : undefined,
      publishedTime: article.created_at,
      modifiedTime: article.updated_at,
    },
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await blog.getArticleBySlug(slug);
  if (!article || !article.published) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-white dark:bg-slate-900 text-gray-900 dark:text-gray-100">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <ArticleJsonLd data={article.jsonLd} />
        <ArticleJsonLd data={article.faqJsonLd} />

        <Link
          href={BLOG_BASE_PATH}
          className="text-sm font-medium text-gray-500 dark:text-slate-400 transition hover:text-gray-700 dark:hover:text-slate-200"
        >
          ← All articles
        </Link>

        <article className="mt-6">
          <header className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              {article.title}
            </h1>
            <time dateTime={article.created_at} className="mt-4 block text-sm text-gray-500 dark:text-slate-400">
              {formatDate(article.created_at)}
            </time>
          </header>

          <div
            className="blog-content"
            dangerouslySetInnerHTML={{ __html: article.content_html }}
          />

          <footer className="mt-12 border-t border-gray-100 dark:border-slate-800 pt-6">
            <TagList keywords={[article.seedKeyword ?? '', ...article.keywords]} />
          </footer>
        </article>
      </div>
    </main>
  );
}
