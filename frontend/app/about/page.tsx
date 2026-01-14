import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Github } from 'lucide-react';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/">
            <Button variant="outline" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-2">
            About <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">ArchiDiff</span>
          </h1>
          <p className="text-gray-400">
            A full-stack web application for comparing architectural details
          </p>
        </div>

        {/* Problem Statement */}
        <section className="mb-12">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">The Problem</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4">
              <p>
                Architects and designers create multiple versions of similar architectural details across different projects. 
                When searching through a detail library, it's difficult to compare these similar details and identify the best 
                version to reuse.
              </p>
              <p>
                Users need a way to visually compare two details side-by-side to spot differences, evaluate quality, and 
                understand how designs have evolved across projects.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Solution */}
        <section className="mb-12">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">The Solution</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-4">
              <p>
                ArchiDiff provides an intuitive interface for overlaying two architectural details on a single canvas 
                with distinct colors (e.g., red and blue). Users can:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Select any two details from a curated library</li>
                <li>Adjust opacity for each layer independently</li>
                <li>Pan, zoom, and align drawings for precise comparison</li>
                <li>Customize overlay colors for better visibility</li>
                <li>Export comparisons as high-quality PNG images</li>
              </ul>
            </CardContent>
          </Card>
        </section>

        {/* Tech Stack */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">Tech Stack</h2>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Frontend */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Frontend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">Next.js 14</h4>
                  <p className="text-gray-400 text-sm">React framework with App Router for modern web apps</p>
                </div>
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">TypeScript</h4>
                  <p className="text-gray-400 text-sm">Type safety and better developer experience</p>
                </div>
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">Tailwind CSS</h4>
                  <p className="text-gray-400 text-sm">Utility-first CSS with custom dark theme</p>
                </div>
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">shadcn/ui</h4>
                  <p className="text-gray-400 text-sm">Professional, accessible UI components</p>
                </div>
                <div>
                  <h4 className="text-blue-400 font-semibold mb-1">Fabric.js</h4>
                  <p className="text-gray-400 text-sm">Powerful canvas library for image overlay and manipulation</p>
                </div>
              </CardContent>
            </Card>

            {/* Backend */}
            <Card className="bg-gray-800/50 border-gray-700">
              <CardHeader>
                <CardTitle className="text-white">Backend</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="text-purple-400 font-semibold mb-1">FastAPI</h4>
                  <p className="text-gray-400 text-sm">Modern Python web framework with automatic API docs</p>
                </div>
                <div>
                  <h4 className="text-purple-400 font-semibold mb-1">Uvicorn</h4>
                  <p className="text-gray-400 text-sm">Lightning-fast ASGI server</p>
                </div>
                <div>
                  <h4 className="text-purple-400 font-semibold mb-1">ezdxf</h4>
                  <p className="text-gray-400 text-sm">DXF/DWG file parsing for CAD files</p>
                </div>
                <div>
                  <h4 className="text-purple-400 font-semibold mb-1">Pillow</h4>
                  <p className="text-gray-400 text-sm">Image processing and manipulation</p>
                </div>
                <div>
                  <h4 className="text-purple-400 font-semibold mb-1">OpenCV</h4>
                  <p className="text-gray-400 text-sm">Computer vision for future auto-alignment features</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Features */}
        <section className="mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">Key Features</h2>
          
          <div className="space-y-4">
            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">✨ Professional Design</h3>
                <p className="text-gray-400">
                  Dark theme with gradient accents, smooth animations, and responsive layout that looks great on all devices.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">🎨 Interactive Canvas</h3>
                <p className="text-gray-400">
                  Powered by Fabric.js for smooth pan, zoom, and overlay operations. Customizable colors and opacity for each layer.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">📁 Local File Management</h3>
                <p className="text-gray-400">
                  No database required. Simple filesystem-based storage for the 6 detail files, perfect for a portfolio project.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/50 border-gray-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-2">💾 High-Quality Export</h3>
                <p className="text-gray-400">
                  Export comparisons as PNG images with 2x resolution multiplier for crisp, professional output.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Future Enhancements */}
        <section className="mb-12">
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white text-2xl">Future Enhancements</CardTitle>
            </CardHeader>
            <CardContent className="text-gray-300 space-y-3">
              <div>
                <h4 className="text-green-400 font-semibold mb-1">🤖 Auto-Alignment</h4>
                <p className="text-gray-400 text-sm">Use OpenCV to automatically align similar features between drawings</p>
              </div>
              <div>
                <h4 className="text-green-400 font-semibold mb-1">🎯 Difference Highlighting</h4>
                <p className="text-gray-400 text-sm">Automatically detect and highlight areas where drawings differ</p>
              </div>
              <div>
                <h4 className="text-green-400 font-semibold mb-1">✏️ Annotation Tools</h4>
                <p className="text-gray-400 text-sm">Add notes, arrows, and callouts directly on the comparison canvas</p>
              </div>
              <div>
                <h4 className="text-green-400 font-semibold mb-1">📊 Batch Comparison</h4>
                <p className="text-gray-400 text-sm">Compare multiple details at once and generate comparison reports</p>
              </div>
              <div>
                <h4 className="text-green-400 font-semibold mb-1">🧠 AI-Powered Similarity</h4>
                <p className="text-gray-400 text-sm">Use machine learning to suggest similar details for comparison</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Project Info */}
        <section className="mb-12">
          <Card className="bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-500/30">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold text-white mb-4">
                Portfolio Project
              </h3>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                ArchiDiff is a personal portfolio project demonstrating full-stack development skills, 
                modern web technologies, and problem-solving in the architecture domain.
              </p>
              <div className="flex gap-4 justify-center">
                <a href="https://github.com/vishantsavaliya/ArchiDiff" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="lg">
                    <Github className="mr-2 h-5 w-5" />
                    View on GitHub
                  </Button>
                </a>
                <Link href="/compare">
                  <Button size="lg">
                    Try It Now
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="text-center text-gray-500 py-8 border-t border-gray-800">
          <p>Built with ❤️ by Vishant Savaliya</p>
          <p className="text-sm mt-2">© 2026 ArchiDiff. All rights reserved.</p>
        </footer>
      </div>
    </div>
  );
}
