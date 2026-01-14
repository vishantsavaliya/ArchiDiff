"use client";

import React, { useState } from 'react';
import DetailSelector from '@/components/DetailSelector';
import ComparisonCanvas from '@/components/ComparisonCanvas';
import { Detail } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function ComparePage() {
  const [detail1, setDetail1] = useState<Detail | null>(null);
  const [detail2, setDetail2] = useState<Detail | null>(null);
  const [detail1Color, setDetail1Color] = useState('#ef4444'); // Red
  const [detail2Color, setDetail2Color] = useState('#3b82f6'); // Blue

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
            Compare <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-600">Details</span>
          </h1>
          <p className="text-gray-400">
            Select two architectural details to overlay and compare side-by-side
          </p>
        </div>

        {/* Main Content */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Panel - Detail 1 Selector */}
          <div className="lg:col-span-1">
            <div className="space-y-4">
              <DetailSelector
                label="Detail 1"
                selectedDetail={detail1}
                onSelectDetail={setDetail1}
                excludeDetailId={detail2?.id}
              />
              
              {detail1 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-white">
                    Detail 1 Color
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={detail1Color}
                      onChange={(e) => setDetail1Color(e.target.value)}
                      className="w-12 h-12 rounded border-2 border-gray-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={detail1Color}
                      onChange={(e) => setDetail1Color(e.target.value)}
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                      placeholder="#ef4444"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Center Panel - Canvas */}
          <div className="lg:col-span-2">
            <ComparisonCanvas
              detail1Filename={detail1?.filename || null}
              detail2Filename={detail2?.filename || null}
              detail1Color={detail1Color}
              detail2Color={detail2Color}
            />
          </div>
        </div>

        {/* Bottom Panel - Detail 2 Selector */}
        <div className="mt-8">
          <div className="space-y-4">
            <DetailSelector
              label="Detail 2"
              selectedDetail={detail2}
              onSelectDetail={setDetail2}
              excludeDetailId={detail1?.id}
            />
            
            {detail2 && (
              <div className="max-w-md space-y-2">
                <label className="text-sm font-medium text-white">
                  Detail 2 Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={detail2Color}
                    onChange={(e) => setDetail2Color(e.target.value)}
                    className="w-12 h-12 rounded border-2 border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={detail2Color}
                    onChange={(e) => setDetail2Color(e.target.value)}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white text-sm"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
