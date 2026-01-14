import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Layers, Eye, Download } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
          Archi<span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Diff</span>
        </h1>
        <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
          Compare architectural details side-by-side with precision. Overlay, adjust, and identify differences across project versions.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/compare">
            <Button size="lg" className="text-lg px-8">
              Start Comparing
            </Button>
          </Link>
          <Link href="/about">
            <Button size="lg" variant="outline" className="text-lg px-8">
              Learn More
            </Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Key Features
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <Layers className="w-12 h-12 text-blue-400 mb-4" />
              <CardTitle className="text-white">Detail Selection</CardTitle>
              <CardDescription>
                Choose from your library of architectural details. Compare any two versions to spot changes.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <Eye className="w-12 h-12 text-purple-400 mb-4" />
              <CardTitle className="text-white">Visual Overlay</CardTitle>
              <CardDescription>
                Overlay details with distinct colors. Adjust opacity, pan, and zoom to analyze differences precisely.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <Download className="w-12 h-12 text-green-400 mb-4" />
              <CardTitle className="text-white">Export & Share</CardTitle>
              <CardDescription>
                Export comparisons as high-quality PNG images. Perfect for presentations and documentation.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="container mx-auto px-4 py-16">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          How It Works
        </h2>
        <div className="max-w-3xl mx-auto space-y-8">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6 flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-xl">
                1
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Select Two Details</h3>
                <p className="text-gray-400">
                  Choose two architectural details from your library to compare. Each detail shows project info, scale, and description.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6 flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-xl">
                2
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Overlay & Adjust</h3>
                <p className="text-gray-400">
                  Both details are overlaid on a single canvas with different colors. Adjust opacity for each layer to see alignments and differences.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-6 flex gap-6 items-start">
              <div className="flex-shrink-0 w-12 h-12 rounded-full bg-green-500 flex items-center justify-center text-white font-bold text-xl">
                3
              </div>
              <div>
                <h3 className="text-xl font-semibold text-white mb-2">Export Results</h3>
                <p className="text-gray-400">
                  Pan, zoom, and align the drawings precisely. When satisfied, export your comparison as a high-quality PNG image.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-500 border-t border-gray-800 mt-16">
        <p>ArchiDiff - A portfolio project by Vishant Savaliya</p>
        <p className="text-sm mt-2">Built with Next.js, FastAPI, and Fabric.js</p>
      </footer>
    </div>
  );
}
