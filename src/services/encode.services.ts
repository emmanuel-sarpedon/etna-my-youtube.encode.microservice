import log4js from "log4js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const logger = log4js.getLogger("encode.service");
logger.level = "trace";

export function getIds(
  videoPath: string,
  publicFolderPath: string
): [userId: number, videoId: number] {
  const ids = videoPath
    .split("/")
    .filter((string) => !publicFolderPath.includes(string));

  return [Number(ids[0]), Number(ids[1])];
}

export async function createVideoFolder(videoFolder: string) {
  await fs.mkdir(
    videoFolder,
    {
      recursive: true,
    },
  );
}

export async function encodeVideo(
  videoPath: string,
  outputPath: string,
  resolution: 1080 | 720 | 480 | 360 | 240 | 144
) {
  try {
    return await new Promise<void>((resolve, reject): void => {
      ffmpeg(videoPath)
        .output(outputPath)
        .size(`?x${resolution}`)
        .on("error", (err) => {
          reject(err);
        })
        .on("end", () => {
          logger.info("Finished processing");
          resolve();
        })
        .on("progress", (progress) => {
          logger.trace("Processing: " + Math.ceil(progress.percent) + "% done");
        })
        .run();
    });
  } catch (e) {
    logger.error(e);
  }
}
