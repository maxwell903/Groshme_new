// pages/budget-register.js
import { NextSeo } from 'next-seo';
import BudgetRegisterPage from '@/components/BudgetRegisterPage';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';

export default function BudgetRegister() {
  const router = useRouter();

  return (
    <>
      <NextSeo
        title="Budget History | Groshme"
        description="Track and analyze your historical budget data, spending patterns, and savings trends over time. View detailed breakdowns of past budgets and transactions."
      />
      
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <button
                  onClick={() => router.back()}
                  className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                  <span>Back to Budget</span>
                </button>
              </div>
              <h1 className="text-xl font-semibold text-gray-900">Fayes Budget History</h1>
              <div className="w-24">{/* Spacer for alignment */}</div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <BudgetRegisterPage />
      </div>
    </>
  );
}