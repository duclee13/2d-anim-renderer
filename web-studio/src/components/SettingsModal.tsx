"use client";

import React from "react";
import { X, Key, Github, Save } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  geminiKey: string;
  setGeminiKey: (k: string) => void;
  githubToken: string;
  setGithubToken: (t: string) => void;
  githubOwner: string;
  setGithubOwner: (o: string) => void;
  githubRepo: string;
  setGithubRepo: (r: string) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  geminiKey,
  setGeminiKey,
  githubToken,
  setGithubToken,
  githubOwner,
  setGithubOwner,
  githubRepo,
  setGithubRepo,
}) => {
  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem("STICKMAN_GEMINI_KEY", geminiKey);
    localStorage.setItem("STICKMAN_GH_TOKEN", githubToken);
    localStorage.setItem("STICKMAN_GH_OWNER", githubOwner);
    localStorage.setItem("STICKMAN_GH_REPO", githubRepo);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl border border-[#27272A] bg-[#121215] p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#232326]">
          <h3 className="text-sm font-semibold text-white">Cấu hình API & Cloud Render</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col space-y-4 py-4 text-xs">
          {/* Gemini API Key */}
          <div className="flex flex-col space-y-1.5">
            <label className="flex items-center space-x-1.5 font-medium text-zinc-300">
              <Key className="h-3.5 w-3.5 text-blue-400" />
              <span>Google Gemini API Key</span>
            </label>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full rounded-xl border border-[#27272A] bg-[#0E0E11] px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-500">Dùng cho Gemini 3.8 / 2.5 Flash để sinh Scene Graph 2D.</span>
          </div>

          {/* GitHub Token */}
          <div className="flex flex-col space-y-1.5">
            <label className="flex items-center space-x-1.5 font-medium text-zinc-300">
              <Github className="h-3.5 w-3.5 text-emerald-400" />
              <span>GitHub Personal Access Token (PAT)</span>
            </label>
            <input
              type="password"
              value={githubToken}
              onChange={(e) => setGithubToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full rounded-xl border border-[#27272A] bg-[#0E0E11] px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
            />
            <span className="text-[10px] text-zinc-500">Cần quyền 'workflow' và 'contents:write' để kích hoạt GitHub Actions.</span>
          </div>

          {/* GitHub Repo */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col space-y-1.5">
              <label className="font-medium text-zinc-300">GitHub Owner</label>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                placeholder="username hoặc org"
                className="w-full rounded-xl border border-[#27272A] bg-[#0E0E11] px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex flex-col space-y-1.5">
              <label className="font-medium text-zinc-300">Repository Name</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                placeholder="repo-name"
                className="w-full rounded-xl border border-[#27272A] bg-[#0E0E11] px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#232326]">
          <button
            onClick={onClose}
            className="rounded-xl border border-[#27272A] bg-[#18181B] px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
          >
            Hủy
          </button>
          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            <Save className="h-3.5 w-3.5" />
            <span>Lưu cấu hình</span>
          </button>
        </div>
      </div>
    </div>
  );
};
