"use client";

import { useState } from "react";
import { api } from "~/trpc/react";

export default function TestBooksPage() {
  const [title, setTitle] = useState("The Great Gatsby");
  const [author, setAuthor] = useState("F. Scott Fitzgerald");

  const { data, isLoading, error, refetch } = api.books.getThumbnail.useQuery(
    {
      title,
      author,
    },
    {
      enabled: false, // Don't auto-fetch, wait for button click
    },
  );

  const handleTest = () => {
    refetch();
  };

  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Test Books Endpoint</h1>

      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium mb-2">Book Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
            placeholder="Enter book title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Author</label>
          <input
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-md"
            placeholder="Enter author name"
          />
        </div>

        <button
          onClick={handleTest}
          disabled={isLoading || !title.trim() || !author.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isLoading ? "Loading..." : "Fetch Thumbnail"}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
          <p className="text-red-800 font-semibold">Error:</p>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}

      {data && (
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-md">
          <h2 className="text-xl font-semibold mb-4">Results</h2>

          {data.found ? (
            <div className="space-y-4">
              {data.thumbnail ? (
                <div>
                  <p className="text-sm font-medium mb-2">Thumbnail:</p>
                  <img
                    src={data.thumbnail}
                    alt={`Cover of ${data.title}`}
                    className="max-w-xs border border-gray-300 rounded shadow"
                    onError={(e) => {
                      e.currentTarget.src = "/placeholder-book.png";
                      e.currentTarget.alt = "Cover not available";
                    }}
                  />
                  <p className="text-xs text-gray-600 mt-2 break-all">
                    {data.thumbnail}
                  </p>
                </div>
              ) : (
                <p className="text-yellow-600">
                  Book found but no thumbnail available
                </p>
              )}

              <div>
                <p className="text-sm font-medium">Title:</p>
                <p className="text-gray-700">{data.title}</p>
              </div>

              <div>
                <p className="text-sm font-medium">Author:</p>
                <p className="text-gray-700">{data.author}</p>
              </div>
            </div>
          ) : (
            <p className="text-yellow-600">
              No book found matching "{title}" by "{author}"
            </p>
          )}

          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
              View Raw JSON
            </summary>
            <pre className="mt-2 p-4 bg-white border border-gray-200 rounded text-xs overflow-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

