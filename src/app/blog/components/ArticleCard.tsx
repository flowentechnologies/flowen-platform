import Image from 'next/image';
import Link from 'next/link';
import type { BlogArticleSummary } from 'babylovegrowth-next-js-blog';
import { BLOG_BASE_PATH } from '../constants';
import { formatDate } from '../format';

export function ArticleCard({ article }: { article: BlogArticleSummary }) {
  return (
    <Link
      href={`${BLOG_BASE_PATH}/${article.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 transition hover:shadow-md dark:hover:shadow-slate-900"
    >
      {article.hero_image_url ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-100 dark:bg-slate-700">
          <Image
            src={article.hero_image_url}
            alt={article.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition duration-300 group-hover:scale-105"
          />
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-5">
        <time dateTime={article.created_at} className="text-xs font-medium text-gray-500 dark:text-slate-400">
          {formatDate(article.created_at)}
        </time>
        <h2 className="mt-2 text-lg font-semibold text-gray-900 dark:text-white transition group-hover:text-gray-600 dark:group-hover:text-slate-300">
          {article.title}
        </h2>
        <p className="mt-2 line-clamp-3 text-sm text-gray-600 dark:text-slate-400">{article.meta_description}</p>
      </div>
    </Link>
  );
}
