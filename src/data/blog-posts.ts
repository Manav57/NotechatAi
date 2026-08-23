// Blog posts data
export const posts = [
  {
    slug: "introducing-noteschatai",
    data: {
      title: "Introducing NotesChatAI: Persistent AI Memory for Students",
      description: "Why we built NotesChatAI and how it differs from NotebookLM and ChatGPT",
      pubDate: new Date("2025-01-15"),
      author: "NotesChatAI Team",
      tags: ["announcement", "product", "ai", "education"],
      heroImage: "/blog/launch-hero.png",
    },
  },
  {
    slug: "notebooklm-comparison",
    data: {
      title: "NotebookLM vs NotesChatAI: A Detailed Comparison",
      description: "How NotesChatAI solves NotebookLM's limitations: unlimited documents, cross-notebook search, persistent memory, and more",
      pubDate: new Date("2025-01-20"),
      author: "NotesChatAI Team",
      tags: ["comparison", "notebooklm", "product", "ai"],
      heroImage: "/blog/comparison-hero.png",
    },
  },
];

export const sortedPosts = [...posts].sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf());