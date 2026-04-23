import { Layout } from "@/components/layout";
import showcaseImageUrl from "@assets/showcase-anime-girl.jpg";

export function ShowcasePage() {
  return (
    <Layout>
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[28px] border border-white/8 bg-[#0f0f10] shadow-none">
          <div className="border-b border-white/8 px-6 py-6 sm:px-8">
            <div className="space-y-3">
              <h1 className="font-display text-3xl font-bold text-foreground">Showcase</h1>
              <p className="text-sm text-muted-foreground">
                Featured visual card added to the gallery.
              </p>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <div className="mx-auto max-w-md overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.03]">
              <img
                src={showcaseImageUrl}
                alt="Featured anime showcase"
                className="block h-auto w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
