"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Detail, fetchDetails } from '@/lib/api';
import { toast } from 'sonner';

interface DetailSelectorProps {
  selectedDetail: Detail | null;
  onSelectDetail: (detail: Detail) => void;
  excludeDetailId?: string; // Exclude this detail ID from selection (to prevent selecting same detail twice)
  label: string;
}

export default function DetailSelector({ 
  selectedDetail, 
  onSelectDetail, 
  excludeDetailId,
  label 
}: DetailSelectorProps) {
  const [details, setDetails] = useState<Detail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const data = await fetchDetails();
      setDetails(data);
    } catch (error) {
      toast.error('Failed to load details. Please check if backend is running.');
      console.error('Error loading details:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">{label}</h3>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-gray-800/50 border-gray-700 animate-pulse">
              <CardHeader className="pb-3">
                <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-3 bg-gray-700 rounded w-full mb-2"></div>
                <div className="h-3 bg-gray-700 rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const availableDetails = excludeDetailId 
    ? details.filter(d => d.id !== excludeDetailId)
    : details;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-black">{label}</h3>
      
      {availableDetails.length === 0 ? (
        <Card className="bg-gray-100 border-gray-300">
          <CardContent className="pt-6">
            <p className="text-gray-700 text-center">
              No details available. Add detail files to <code className="text-blue-600">backend/details/</code>
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {availableDetails.map((detail) => {
            const isSelected = selectedDetail?.id === detail.id;
            
            return (
              <Card
                key={detail.id}
                className={`cursor-pointer transition-all duration-200 border-2 ${
                  isSelected
                    ? 'bg-blue-50 border-blue-500 ring-2 ring-blue-500'
                    : 'bg-white border-gray-300 hover:border-gray-400 hover:bg-gray-50'
                }`}
                onClick={() => onSelectDetail(detail)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base text-black leading-tight">
                    {detail.name}
                  </CardTitle>
                  <CardDescription className="text-xs text-gray-600">
                    {detail.project}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  <p className="text-sm text-gray-800">
                    <span className="text-gray-600">Scale:</span> {detail.scale}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-2">
                    {detail.description}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    {detail.filename}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
