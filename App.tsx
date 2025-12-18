
import React, { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CATEGORIES } from './constants';
import { AIModelType, Config } from './types';
import { queryGemini, generateStructuralImage } from './geminiService';
import { queryDeepSeek } from './deepseekService';

// --- Sub-components ---

const SidebarItem: React.FC<{ 
  category: typeof CATEGORIES[0]; 
  activeItem: string; 
  onSelect: (item: string) => void;
  isExpanded: boolean;
  toggleExpand: () => void;
}> = ({ category, activeItem, onSelect, isExpanded, toggleExpand }) => {
  return (
    <div className="mb-2">
      <button 
        onClick={toggleExpand}
        className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-indigo-50 rounded-lg transition-colors group"
      >
        <div className="flex items-center gap-3">
          <i className={`fa-solid ${category.icon} text-indigo-500 w-5`}></i>
          <span>{category.title}</span>
        </div>
        <i className={`fa-solid fa-chevron-down text-xs transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}></i>
      </button>
      
      {isExpanded && (
        <div className="mt-1 ml-9 flex flex-col gap-1 border-l border-slate-200">
          {category.items.map(item => (
            <button
              key={item}
              onClick={() => onSelect(item)}
              className={`text-left px-3 py-1.5 text-xs rounded-r-md transition-all ${
                activeItem === item 
                  ? 'bg-indigo-100 text-indigo-700 border-l-2 border-indigo-600 font-medium' 
                  : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SettingsModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  config: Config; 
  setConfig: (c: Config) => void;
}> = ({ isOpen, onClose, config, setConfig }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <i className="fa-solid fa-gear text-indigo-600"></i>
            系统设置
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <i className="fa-solid fa-xmark text-xl"></i>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <i className="fa-solid fa-microchip text-indigo-500"></i>
              选择 AI 模型
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setConfig({ ...config, modelType: AIModelType.GEMINI })}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  config.modelType === AIModelType.GEMINI 
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-slate-100 hover:border-indigo-200'
                }`}
              >
                <span className="font-bold text-indigo-700">Gemini</span>
                <span className="text-[10px] text-slate-400">带搜索与绘图</span>
              </button>
              <button
                onClick={() => setConfig({ ...config, modelType: AIModelType.DEEPSEEK })}
                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                  config.modelType === AIModelType.DEEPSEEK 
                    ? 'border-indigo-600 bg-indigo-50' 
                    : 'border-slate-100 hover:border-indigo-200'
                }`}
              >
                <span className="font-bold text-slate-700">DeepSeek</span>
                <span className="text-[10px] text-slate-400">纯文本处理</span>
              </button>
            </div>
          </div>

          {config.modelType === AIModelType.DEEPSEEK && (
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                DeepSeek API Key
              </label>
              <input
                type="password"
                value={config.deepseekApiKey}
                onChange={(e) => setConfig({ ...config, deepseekApiKey: e.target.value })}
                placeholder="在此输入您的 API Key"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              <p className="mt-2 text-[10px] text-slate-400">
                您的 Key 将仅保存在本地浏览器中。
              </p>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-50 border-t">
          <button
            onClick={onClose}
            className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
          >
            保存并返回
          </button>
        </div>
      </div>
    </div>
  );
};

// --- Main App ---

export default function App() {
  const [activeItem, setActiveItem] = useState('');
  const [expandedIds, setExpandedIds] = useState<string[]>(['mandatory']);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [content, setContent] = useState<{ text: string; image?: string; sources?: { title: string; uri: string }[] } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<Config>(() => {
    const saved = localStorage.getItem('app-config');
    return saved ? JSON.parse(saved) : { modelType: AIModelType.GEMINI, deepseekApiKey: '' };
  });

  useEffect(() => {
    localStorage.setItem('app-config', JSON.stringify(config));
  }, [config]);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    setIsLoading(true);
    setActiveItem('');
    setContent(null);

    try {
      let resultText = '';
      let sources: { title: string; uri: string }[] = [];
      let imageUrl: string | null = null;

      if (config.modelType === AIModelType.GEMINI) {
        const geminiRes = await queryGemini(query);
        resultText = geminiRes.text;
        sources = geminiRes.sources || [];
        // Generate image only for Gemini
        imageUrl = await generateStructuralImage(query);
      } else {
        const dsRes = await queryDeepSeek(query, config.deepseekApiKey);
        resultText = dsRes.text;
      }

      setContent({ text: resultText, image: imageUrl || undefined, sources });
    } catch (error: any) {
      alert(error.message || "请求失败，请检查网络或 API Key");
    } finally {
      setIsLoading(false);
    }
  }, [config]);

  const onSelectTopic = (item: string) => {
    setActiveItem(item);
    setSearchQuery(item);
    handleSearch(`请详细讲解关于“${item}”的结构概念及其在中国规范中的相关强条要求。`);
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex h-screen bg-white text-slate-900 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 border-r border-slate-100 flex flex-col bg-white shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-slate-50">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white">
            <i className="fa-solid fa-compass-drafting text-xl"></i>
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight">建筑结构智库</h1>
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest leading-none mt-1">AI Structural Engine</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <div className="space-y-1">
            {CATEGORIES.map(cat => (
              <SidebarItem 
                key={cat.id}
                category={cat}
                activeItem={activeItem}
                onSelect={onSelectTopic}
                isExpanded={expandedIds.includes(cat.id)}
                toggleExpand={() => toggleExpand(cat.id)}
              />
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-slate-50">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all font-medium text-sm"
          >
            <i className="fa-solid fa-sliders"></i>
            模型设置
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-slate-50/50 relative overflow-hidden">
        {/* Search Header */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-100 px-8 flex items-center sticky top-0 z-10">
          <div className="max-w-4xl w-full mx-auto relative group">
            <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-500 transition-colors"></i>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch(searchQuery)}
              placeholder="搜索结构概念、规范条文或强条..."
              className="w-full pl-12 pr-24 py-3 bg-slate-100 border-none rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:bg-white transition-all text-sm outline-none shadow-sm"
            />
            <button
              onClick={() => handleSearch(searchQuery)}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 active:scale-95"
            >
              查询
            </button>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-4xl mx-auto">
            {!content && !isLoading && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-24 h-24 bg-white rounded-3xl shadow-xl flex items-center justify-center mb-6 border border-slate-50 animate-bounce-slow">
                  <i className="fa-solid fa-book-open-reader text-4xl text-indigo-500"></i>
                </div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">开启您的结构知识探索</h2>
                <p className="text-slate-500 max-w-md">
                  快速检索中国现行建筑规范强条要求，深度解析结构概念及工程应用逻辑。
                </p>
                <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-lg">
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
                    <div className="w-8 h-8 bg-red-50 text-red-600 rounded-lg flex items-center justify-center mb-3">
                      <i className="fa-solid fa-shield-halved text-sm"></i>
                    </div>
                    <h3 className="font-bold text-sm mb-1">强条检索</h3>
                    <p className="text-[11px] text-slate-400">快速定位GB 550xx系列通用规范强制性条文。</p>
                  </div>
                  <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm text-left">
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center mb-3">
                      <i className="fa-solid fa-pencil text-sm"></i>
                    </div>
                    <h3 className="font-bold text-sm mb-1">概念解析</h3>
                    <p className="text-[11px] text-slate-400">可视化解析力学原理与构造设计逻辑。</p>
                  </div>
                </div>
              </div>
            )}

            {isLoading && (
              <div className="space-y-8 py-4">
                <div className="animate-pulse bg-white p-8 rounded-3xl shadow-sm space-y-4 border border-slate-100">
                  <div className="h-8 bg-slate-100 rounded-full w-3/4"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-slate-100 rounded-full w-full"></div>
                    <div className="h-4 bg-slate-100 rounded-full w-5/6"></div>
                    <div className="h-4 bg-slate-100 rounded-full w-4/5"></div>
                  </div>
                  <div className="h-64 bg-slate-50 rounded-2xl w-full"></div>
                </div>
              </div>
            )}

            {content && (
              <article className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mb-12">
                {content.image && (
                  <div className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                    <img 
                      src={content.image} 
                      alt="Structural Illustration" 
                      className="w-full h-auto max-h-[500px] object-contain rounded-2xl bg-slate-50 mx-auto"
                    />
                    <p className="text-center text-[10px] text-slate-400 mt-5 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                      <span className="w-8 h-[1px] bg-slate-200"></span>
                      AI 生成受力示意图 (无文字纯概念参考)
                      <span className="w-8 h-[1px] bg-slate-200"></span>
                    </p>
                  </div>
                )}

                <div className="bg-white p-8 md:p-12 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 prose prose-slate prose-indigo max-w-none">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({node, ...props}) => <h1 className="text-3xl font-extrabold mb-8 text-slate-900 border-b-2 border-slate-50 pb-6" {...props} />,
                      h2: ({node, ...props}) => <h2 className="text-2xl font-bold mt-12 mb-6 text-slate-800 flex items-center gap-3" {...props} />,
                      h3: ({node, ...props}) => <h3 className="text-xl font-bold mt-8 mb-4 text-slate-800" {...props} />,
                      blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-4 border-red-500 bg-red-50/50 p-6 my-6 rounded-r-2xl italic text-slate-700" {...props} />
                      ),
                      code: ({node, ...props}) => (
                        <code className="bg-slate-100 text-indigo-600 px-1.5 py-0.5 rounded font-mono text-sm" {...props} />
                      ),
                      table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-8">
                          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg" {...props} />
                        </div>
                      ),
                      th: ({node, ...props}) => <th className="px-4 py-2 bg-slate-50 font-bold text-slate-700 text-left" {...props} />,
                      td: ({node, ...props}) => <td className="px-4 py-2 border-t border-slate-100" {...props} />,
                    }}
                  >
                    {content.text}
                  </ReactMarkdown>
                </div>

                {content.sources && content.sources.length > 0 && (
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                    <h3 className="text-xs font-bold mb-5 flex items-center gap-2 uppercase tracking-widest text-indigo-400">
                      <i className="fa-solid fa-link"></i> 相关规范条文与在线参考
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {content.sources.map((source, i) => (
                        <a 
                          key={i} 
                          href={source.uri} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-2xl transition-all group border border-white/10"
                        >
                          <span className="text-xs font-medium truncate pr-4 text-slate-300 group-hover:text-white">{source.title}</span>
                          <i className="fa-solid fa-arrow-up-right-from-square text-[10px] opacity-40 group-hover:opacity-100 text-indigo-400"></i>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )}
          </div>
        </div>
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        setConfig={setConfig}
      />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #e2e8f0;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #cbd5e1;
        }
        @keyframes bounce-slow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-bounce-slow {
          animation: bounce-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
