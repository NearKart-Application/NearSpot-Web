export default function NoStoreBanner({ feature = 'this feature' }: { feature?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-4">
      <div className="text-5xl mb-4">🏪</div>
      <h2 className="text-xl font-bold text-navy mb-2">No Store Found</h2>
      <p className="text-gray-500 mb-6 max-w-sm text-sm">
        You need to set up your store before you can use {feature}.
      </p>
      <a href="/vendor/store-setup"
         className="inline-flex items-center gap-2 bg-navy text-white font-bold px-6 py-3 rounded-2xl hover:bg-navy/90 transition-colors text-sm">
        🚀 Set Up My Store
      </a>
    </div>
  );
}
