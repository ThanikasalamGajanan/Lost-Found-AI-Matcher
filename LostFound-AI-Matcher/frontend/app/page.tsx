import Link from 'next/link';
import { Search, ShieldCheck, Zap } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="flex flex-col items-center text-center py-16">
      {/* Hero */}
      <h1 className="text-5xl font-bold text-gray-900 max-w-3xl leading-tight">
        Lost something? <span className="text-primary-600">AI can help</span> find it.
      </h1>
      <p className="mt-6 text-lg text-gray-600 max-w-2xl">
        Report your lost or found item and our AI matching engine will automatically
        compare descriptions, images, locations, and timestamps to find the best match.
      </p>

      {/* CTA Buttons */}
      <div className="mt-10 flex gap-4">
        <Link href="/report/lost" className="btn-primary text-lg px-8 py-3">
          I Lost Something
        </Link>
        <Link href="/report/found" className="btn-secondary text-lg px-8 py-3">
          I Found Something
        </Link>
      </div>

      {/* Features */}
      <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl">
        <FeatureCard
          icon={<Search className="w-8 h-8 text-primary-600" />}
          title="AI-Powered Matching"
          description="Our engine uses embeddings, vision models, and weighted scoring to find the best matches automatically."
        />
        <FeatureCard
          icon={<ShieldCheck className="w-8 h-8 text-primary-600" />}
          title="Verification Questions"
          description="Protect your items with smart verification — only the real owner can answer private-detail questions."
        />
        <FeatureCard
          icon={<Zap className="w-8 h-8 text-primary-600" />}
          title="Instant Notifications"
          description="Get notified immediately when a potential match is found, via in-app alerts or email."
        />
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="mt-2 text-sm text-gray-600">{description}</p>
    </div>
  );
}
