// Video playlist for the "Watch" section. To add a video: drop the file in
// public/media/videos/ and add an entry here — the player and playlist update automatically.
//   poster (optional): image shown before play; falls back to the video's first frame.
//   description (optional): one line shown under the title.
export const videos = [
  {
    id: 'grove-1',
    // TODO(client): confirm title / description for this video
    title: 'Life at Grove',
    description: 'A look inside Grove Mixed Martial Arts.',
    src: '/media/videos/grove-video-1.mp4',
    poster: null,
  },
]
