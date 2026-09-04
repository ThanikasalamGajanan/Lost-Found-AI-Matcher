'use client';

import Image from 'next/image';

interface SimilarItem {
  id: string;
  category: string;
  brand: string | null;
  colour: string | null;
  description: string;
  location: string;
  photo_url: string | null;
  similarity_score: number;
}

interface SimilarItemsProps {
  items: SimilarItem[];
  label: 'lost' | 'found';
}

export function SimilarItems({ items, label }: SimilarItemsProps) {
  if (items.length === 0) return null;

  return (
    <div className="mt-6">
      <h2 className="text-lg font-semibold mb-3">
        {label === 'lost'
          ? 'Similar Found Items'
          : 'Similar Lost Items'}
      </h2>
      <div className="grid gap-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-4 p-4 rounded-lg border bg-white shadow-sm"
          >
            {/* Photo */}
            {item.photo_url ? (
              <Image
                src={item.photo_url}
                alt={item.category}
                width={64}
                height={64}
                className="rounded object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 text-xs text-gray-400">
                No photo
              </div>
            )}

            {/* Details */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">
                {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                {item.brand ? ` — ${item.brand}` : ''}
                {item.colour ? ` (${item.colour})` : ''}
              </p>
              <p className="text-xs text-gray-500 truncate mt-0.5">{item.description}</p>
              <p className="text-xs text-gray-400 mt-0.5">{item.location}</p>
            </div>

            {/* Score badge */}
            <div className="flex-shrink-0 text-center">
              <span
                className={`inline-block text-xs font-bold px-2 py-1 rounded-full ${
                  item.similarity_score >= 70
                    ? 'bg-green-100 text-green-700'
                    : item.similarity_score >= 50
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-gray-100 text-gray-600'
                }`}
              >
                {item.similarity_score}%
              </span>
              <p className="text-[10px] text-gray-400 mt-1">match</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
