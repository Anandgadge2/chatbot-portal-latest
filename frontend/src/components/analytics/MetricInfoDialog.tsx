'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Info, TrendingUp, Calculator, Target } from 'lucide-react';

export interface MetricInfo {
  title: string;
  description: string;
  formula: string;
  interpretation: string;
  currentValue: number | string;
  benchmark?: string;
  icon?: 'info' | 'trending' | 'calculator' | 'target';
}

interface MetricInfoDialogProps {
  isOpen: boolean;
  onClose: () => void;
  metric: MetricInfo | null;
}

export default function MetricInfoDialog({ isOpen, onClose, metric }: MetricInfoDialogProps) {
  if (!metric) return null;

  const getIcon = () => {
    switch (metric.icon) {
      case 'trending':
        return <TrendingUp className="w-6 h-6 text-blue-600" />;
      case 'calculator':
        return <Calculator className="w-6 h-6 text-purple-600" />;
      case 'target':
        return <Target className="w-6 h-6 text-green-600" />;
      default:
        return <Info className="w-6 h-6 text-blue-600" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center space-x-3">
            {getIcon()}
            <DialogTitle className="text-2xl">{metric.title}</DialogTitle>
          </div>
          <DialogDescription className="text-base mt-2">
            {metric.description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Current Value */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-2">
              Current Value
            </h3>
            <p className="text-4xl font-bold text-blue-600">{metric.currentValue}</p>
            {metric.benchmark && (
              <p className="text-sm text-gray-600 mt-2">
                <span className="font-medium">Benchmark:</span> {metric.benchmark}
              </p>
            )}
          </div>

          {/* Formula */}
          {/* <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
              Calculation Formula
            </h3>
            <div className="bg-white rounded p-4 border border-gray-300">
              <code className="text-sm font-mono text-gray-800">{metric.formula}</code>
            </div>
          </div> */}

          {/* Interpretation */}
          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-6 border border-green-100">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-3 flex items-center">
              <TrendingUp className="w-4 h-4 mr-2" />
              What This Means
            </h3>
            <p className="text-gray-700 leading-relaxed">{metric.interpretation}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
