import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Sparkles,
  PlayCircle,
  UploadCloud,
  MessageSquareText,
  CheckCircle2,
  BarChart3,
  GitCompare,
  Download,
  HelpCircle,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Code2,
} from 'lucide-react'

export const HowToUsePage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const isHi = i18n.language === 'hi'

  const [tourStep, setTourStep] = useState<number | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)

  const steps = [
    {
      num: 1,
      title: isHi ? '1. डेटासेट अपलोड और निरीक्षण' : '1. Upload & Inspect Dataset',
      desc: isHi
        ? 'CSV, Excel (.xlsx, .xls) या JSON फ़ाइल अपलोड करें। डेटा स्वतः विश्लेषण किया जाता है और पंक्तियाँ, स्तंभ, डेटा प्रकार, अनुपस्थित मान और डुप्लिकेट्स प्रदर्शित होते हैं।'
        : 'Upload CSV, Excel (.xlsx/.xls), or JSON files up to 50MB. DataMend analyzes the structure, datatypes, missing counts, duplicate rows, and outlier boundaries instantly.',
      icon: UploadCloud,
      color: 'bg-blue-500',
    },
    {
      num: 2,
      title: isHi ? '2. प्राकृतिक भाषा में निर्देश लिखें' : '2. Write Natural-Language Prompts',
      desc: isHi
        ? 'अपनी आवश्यकता को सामान्य भाषा में लिखें, जैसे "डुप्लिकेट पंक्तियाँ हटाएं", "संख्यात्मक स्तंभों में रिक्त मानों को माध्यिका से भरें", या "2025 का डेटा रखें"।'
        : 'Describe your data cleaning objective in plain English or Hindi: e.g., "Remove duplicate records and fill null values in salary with median".',
      icon: MessageSquareText,
      color: 'bg-purple-500',
    },
    {
      num: 3,
      title: isHi ? '3. पारदर्शी योजना की समीक्षा और स्वीकृति' : '3. Review & Approve Transformation Plan',
      desc: isHi
        ? 'प्रणाली एक सत्यापन योग्य संरचित योजना प्रस्तुत करती है। इसमें प्रभावित स्तंभ, प्रभाव का अनुमान और संभावित चेतावनियाँ शामिल होती हैं। आपकी स्वीकृति के बिना कोई बदलाव नहीं किया जाता।'
        : 'DataMend generates a structured plan with affected columns, parameters, and loss warnings. Review and confirm before any execution.',
      icon: CheckCircle2,
      color: 'bg-green-500',
    },
    {
      num: 4,
      title: isHi ? '4. वास्तविक गणना और इंटरएक्टिव चार्ट' : '4. Real Statistics & Plotly Visualizations',
      desc: isHi
        ? 'माध्य, माध्यिका, मानक विचलन, चतुर्थक और ककुदता जैसे वास्तविक सांख्यिकीय उपाय देखें। ज़ूम, टूलटिप और लीजेंड्स के साथ समृद्ध प्लॉटली चार्ट बनाएं।'
        : 'Explore descriptive stats (mean, median, IQR, skewness, kurtosis) and interactive Plotly charts (histograms, scatter, box plots, correlation heatmaps).',
      icon: BarChart3,
      color: 'bg-amber-500',
    },
    {
      num: 5,
      title: isHi ? '5. ऐतिहासिक तुलना और निर्यात' : '5. Compare & Export Reproducible Reports',
      desc: isHi
        ? 'मूल और साफ़ किए गए डेटासेट की आमने-सामने तुलना करें। वास्तविक PDF, HTML रिपोर्ट, साफ़ की गई CSV/Excel फ़ाइलें और पुनरुत्पादक पायथन स्क्रिप्ट डाउनलोड करें।'
        : 'Compare pre/post cleaning metrics side-by-side. Download genuine PDF/HTML audit reports, cleaned CSV/Excel files, and self-contained Python scripts.',
      icon: Download,
      color: 'bg-indigo-500',
    },
  ]

  const faqs = [
    {
      q: isHi ? 'क्या मेरा मूल डेटासेट सुरक्षित रहता है?' : 'Is my original dataset permanently preserved?',
      a: isHi
        ? 'हाँ, DataMend कभी भी आपकी मूल अपलोड की गई फ़ाइल को अधिलेखित (overwrite) नहीं करता है। प्रत्येक सफ़ाई एक नया अपरिवर्तनीय (immutable) संस्करण बनाती है।'
        : 'Yes. DataMend never overwrites your original uploaded files. Each cleaning iteration generates a new immutable version with full audit history.',
    },
    {
      q: isHi ? 'क्या संख्याएँ या आँकड़े काल्पनिक होते हैं?' : 'Are statistics or numbers ever simulated or fabricated?',
      a: isHi
        ? 'बिल्कुल नहीं। प्लेटफ़ॉर्म पर दिखाए जाने वाले सभी परिणाम, तालिकाएं, चार्ट और रिपोर्ट वास्तविक डेटासेट और वास्तविक पायथन/पांडास गणनाओं पर आधारित होते हैं।'
        : 'Never. Every statistic, count, percentage, and visualization is computed directly from your uploaded dataset using Python Pandas and SciPy.',
    },
    {
      q: isHi ? 'यदि AI प्रदाता उपलब्ध न हो तो क्या काम रुक जाएगा?' : 'What if the external AI service is unreachable?',
      a: isHi
        ? 'नहीं। DataMend में एक अंतर्निहित नियम-आधारित (rule-based) एनएलपी दुभाषिया शामिल है जो बिना किसी बाह्य कुंजी के सामान्य सफ़ाई निर्देशों को समझता है।'
        : 'DataMend includes a built-in deterministic rule-based NLP interpreter that understands dozens of cleaning intents even without an OpenAI API key.',
    },
    {
      q: isHi ? 'मैं अपनी सफ़ाई को कोड के रूप में कैसे पुनः उपयोग कर सकता हूँ?' : 'How do I reproduce the cleaning pipeline in Python?',
      a: isHi
        ? 'प्रत्येक पूर्ण विश्लेषण के बाद "पायथन स्क्रिप्ट डाउनलोड करें" बटन पर क्लिक करें। आपको एक पूर्णतः कार्यात्मक .py स्क्रिप्ट प्राप्त होगी जिसे स्थानीय रूप से चलाया जा सकता है।'
        : 'Every analysis report includes a "Download Python Script" option that outputs a ready-to-run .py script using Pandas with all your exact transformation steps.',
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in max-w-5xl mx-auto">
      {/* Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[var(--color-accent)] to-purple-700 text-white p-8 md:p-10 shadow-lg">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isHi ? 'शुरुआती मार्गदर्शिका' : 'Beginner-Friendly Platform Guide'}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight leading-tight">
            {isHi ? 'DataMend में आपका स्वागत है' : 'Master Data Cleaning with DataMend'}
          </h1>
          <p className="mt-3 text-sm md:text-base text-white/90 leading-relaxed">
            {isHi
              ? 'डेटा सफ़ाई, गुणवत्ता मूल्यांकन, इंटरएक्टिव विज़ुअलाइज़ेशन और ऐतिहासिक तुलना के लिए आपका पारदर्शी और विश्वसनीय साथी।'
              : 'Prompt-driven data cleaning, transparent transformation plans, interactive charts, and evidence-based historical comparison.'}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setTourStep(0)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-purple-900 font-bold text-sm hover:bg-white/90 shadow-md transition-all"
            >
              <PlayCircle className="w-4 h-4 text-purple-700" />
              <span>{isHi ? 'इंटरएक्टिव टूर शुरू करें' : 'Start Guided Tour'}</span>
            </button>
            <a
              href="/data-lab"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-md text-white font-semibold text-sm transition-all"
            >
              <span>{isHi ? 'डेटा लैब पर जाएं' : 'Open Data Lab'}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Interactive Tour Modal Overlay */}
      {tourStep !== null && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1A2744] text-[var(--color-text)] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-gray-200/50">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200/40">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-accent)]">
                {isHi ? `कदम ${tourStep + 1} / ${steps.length}` : `Step ${tourStep + 1} of ${steps.length}`}
              </span>
              <button
                onClick={() => setTourStep(null)}
                className="text-gray-400 hover:text-gray-700 text-xs font-semibold px-2 py-1 rounded-md"
              >
                ✕ {isHi ? 'बंद करें' : 'Close'}
              </button>
            </div>

            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${steps[tourStep].color} text-white flex items-center justify-center shrink-0`}>
                {React.createElement(steps[tourStep].icon, { className: 'w-5 h-5' })}
              </div>
              <h3 className="text-lg font-bold">{steps[tourStep].title}</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed mb-6">
              {steps[tourStep].desc}
            </p>

            <div className="flex items-center justify-between pt-4 border-t border-gray-200/40">
              <button
                onClick={() => setTourStep((prev) => (prev !== null && prev > 0 ? prev - 1 : null))}
                disabled={tourStep === 0}
                className="px-4 py-2 text-xs font-semibold rounded-lg border border-gray-300 dark:border-gray-600 disabled:opacity-40"
              >
                {isHi ? 'पिछला' : 'Previous'}
              </button>
              {tourStep < steps.length - 1 ? (
                <button
                  onClick={() => setTourStep((prev) => (prev !== null ? prev + 1 : null))}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-[var(--color-accent)] text-white shadow-sm"
                >
                  {isHi ? 'अगला कदम →' : 'Next Step →'}
                </button>
              ) : (
                <button
                  onClick={() => setTourStep(null)}
                  className="px-5 py-2 text-xs font-bold rounded-lg bg-green-600 text-white shadow-sm"
                >
                  {isHi ? 'टूर समाप्त करें ✓' : 'Finish Tour ✓'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5 Core Steps Illustrated Cards */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">
          {isHi ? 'DataMend की 5-चरणीय कार्यप्रणाली' : 'The 5-Step DataMend Workflow'}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {steps.map((st) => {
            const Icon = st.icon
            return (
              <div
                key={st.num}
                className="rounded-2xl p-5 bg-white/70 dark:bg-black/20 border border-gray-200/50 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="w-7 h-7 rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)] font-bold text-xs flex items-center justify-center">
                      0{st.num}
                    </span>
                    <Icon className="w-5 h-5 text-[var(--color-accent)]" />
                  </div>
                  <h3 className="font-bold text-sm mb-2">{st.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{st.desc}</p>
                </div>
              </div>
            )
          })}

          {/* Reproducibility Callout Card */}
          <div className="rounded-2xl p-5 bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/50 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs mb-2">
                <Code2 className="w-4 h-4" />
                <span>{isHi ? '100% पुनरुत्पादक' : '100% Reproducible'}</span>
              </div>
              <h3 className="font-bold text-sm mb-2">{isHi ? 'पारदर्शी कोड निर्यात' : 'Export Ready Python'}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                {isHi
                  ? 'सभी रूपांतरण चरण एक साफ, टिप्पणी-युक्त पायथन स्क्रिप्ट में निर्यात किए जा सकते हैं ताकि सहकर्मी आपकी सफ़ाई को स्वतंत्र रूप से सत्यापित कर सकें।'
                  : 'Every single transformation step is mapped to genuine Pandas code. Export your workflow as an executable Python script anytime.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Accordion */}
      <div className="pt-4">
        <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-[var(--color-accent)]" />
          <span>{isHi ? 'अक्सर पूछे जाने वाले प्रश्न (FAQs)' : 'Frequently Asked Questions'}</span>
        </h2>
        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="rounded-xl border border-gray-200/60 bg-white/70 dark:bg-black/20 overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                className="w-full flex items-center justify-between p-4 text-left font-semibold text-sm hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`}
                />
              </button>
              {openFaq === idx && (
                <div className="px-4 pb-4 pt-1 text-xs text-gray-600 dark:text-gray-300 border-t border-gray-200/40 leading-relaxed">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

