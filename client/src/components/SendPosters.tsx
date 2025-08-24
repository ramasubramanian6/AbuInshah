import React, { useState, useEffect } from "react";

const SendPosters: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [designation, setDesignation] = useState<string>(
    "Health insurance advisor"
  );
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Remove team dropdown logic

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setPreview(URL.createObjectURL(selectedFile));
      setMessage(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setMessage("Please select a poster template image.");
      return;
    }


    const formData = new FormData();
    formData.append("template", file); // ✅ Matches backend field
    formData.append("designation", designation); // ✅ Required by backend
  // No teamName needed for Team, backend will send to all team members

    setLoading(true);
    setMessage(null);

    try {
      const API_URL = import.meta.env.VITE_API_URL;
      const res = await fetch(`${API_URL}api/send-posters`, {
        method: "POST",
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        setMessage(`✅ ${result.recipientCount} posters sent successfully!`);
      } else {
        setMessage(result.error || "❌ Failed to send posters.");
      }
    } catch (err) {
      console.error(err);
      setMessage("❌ Server error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-6 bg-white rounded-lg shadow-lg ">
      <h2 className="text-2xl font-semibold mb-4">Send Personalized Posters</h2>

      <form onSubmit={handleSubmit}>
        <label className="block mb-2 text-sm font-medium overflow-auto text-gray-700">
          Choose Designation
        </label>

        <select
          className="w-full max-w-[220px] text-sm p-2 mb-4 border rounded mx-auto md:text-base md:max-w-full"
          style={{ maxWidth: 220 }}
          value={designation}
          onChange={(e) => {
            setDesignation(e.target.value);
            setSelectedTeam("");
          }}
        >
          <option value="Health insurance advisor">
            Health insurance advisor
          </option>
          <option value="Wealth Manager">Wealth Manager</option>
          <option value="Partner">Partner</option>
          <option value="Team">Team</option> {/* ✅ New option added */}
        </select>

  {/* No team dropdown, all team members will receive the poster */}

        <label className="block mb-2 text-sm font-medium text-gray-700">
          Upload Poster Template
        </label>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="mb-4 w-full"
        />

        {preview && (
          // Adjusted preview container for better responsiveness
          <div className="mb-4 p-2 border rounded flex justify-center items-center overflow-hidden">
            <img
              src={preview}
              alt="Poster Preview"
              // `max-w-full` ensures the image doesn't exceed its parent's width.
              // `h-auto` maintains the aspect ratio.
              // `object-contain` scales the image to fit within the content box.
              className="max-w-full h-auto object-contain"
              style={{ maxHeight: "24rem" }} // Set a max-height using inline style for more control (24rem = 384px)
            />
          </div>
        )}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          disabled={loading}
        >
          {loading ? "Sending..." : "Send Posters"}
        </button>
      </form>

      {message && (
        <p className="mt-4 text-center text-sm text-gray-700">{message}</p>
      )}
    </div>
  );
};

export default SendPosters;
