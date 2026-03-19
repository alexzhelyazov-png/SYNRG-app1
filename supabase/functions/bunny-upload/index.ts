/**
 * Supabase Edge Function: Bunny Stream Video Management
 *
 * Actions:
 * - create: Create a video entry in Bunny Stream, return upload URL + embed URL
 * - list:   List videos in the library
 * - delete: Delete a video
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const BUNNY_API_KEY = Deno.env.get("BUNNY_API_KEY");
    const BUNNY_LIBRARY_ID = Deno.env.get("BUNNY_LIBRARY_ID");

    if (!BUNNY_API_KEY || !BUNNY_LIBRARY_ID) {
      return new Response(
        JSON.stringify({ error: "Bunny credentials not configured" }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const { action, title, videoId } = await req.json();

    // ── CREATE: Create video entry and return upload URL ──────
    if (action === "create") {
      if (!title) {
        return new Response(
          JSON.stringify({ error: "Title is required" }),
          { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      // 1. Create video in Bunny Stream
      const createRes = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos`,
        {
          method: "POST",
          headers: {
            AccessKey: BUNNY_API_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ title }),
        }
      );

      if (!createRes.ok) {
        const errText = await createRes.text();
        console.error("Bunny create error:", errText);
        return new Response(
          JSON.stringify({ error: "Failed to create video" }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const video = await createRes.json();
      const vid = video.guid;

      // 2. Return upload URL and embed URL
      // Upload via PUT: https://video.bunnycdn.com/library/{libraryId}/videos/{videoId}
      // The frontend will upload the file directly to this URL
      return new Response(
        JSON.stringify({
          videoId: vid,
          uploadUrl: `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${vid}`,
          embedUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${vid}`,
          thumbnailUrl: `https://vz-${BUNNY_LIBRARY_ID}.b-cdn.net/${vid}/thumbnail.jpg`,
          apiKey: BUNNY_API_KEY,  // Needed for frontend PUT upload
        }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── LIST: List videos ────────────────────────────────────
    if (action === "list") {
      const listRes = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos?page=1&itemsPerPage=100&orderBy=date`,
        {
          headers: { AccessKey: BUNNY_API_KEY },
        }
      );

      if (!listRes.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to list videos" }),
          { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
        );
      }

      const data = await listRes.json();
      const videos = (data.items || []).map((v: any) => ({
        id: v.guid,
        title: v.title,
        status: v.status === 4 ? "ready" : v.status === 3 ? "processing" : "pending",
        length: v.length,  // seconds
        size: v.storageSize,
        embedUrl: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${v.guid}`,
        thumbnailUrl: `https://vz-${BUNNY_LIBRARY_ID}.b-cdn.net/${v.guid}/thumbnail.jpg`,
        createdAt: v.dateUploaded,
      }));

      return new Response(
        JSON.stringify({ videos, totalItems: data.totalItems }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // ── DELETE: Delete a video ────────────────────────────────
    if (action === "delete" && videoId) {
      const delRes = await fetch(
        `https://video.bunnycdn.com/library/${BUNNY_LIBRARY_ID}/videos/${videoId}`,
        {
          method: "DELETE",
          headers: { AccessKey: BUNNY_API_KEY },
        }
      );

      return new Response(
        JSON.stringify({ success: delRes.ok }),
        { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("bunny-upload error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
