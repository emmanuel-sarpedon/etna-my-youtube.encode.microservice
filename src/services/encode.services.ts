import log4js from "log4js";
import ffmpeg from "fluent-ffmpeg";
import fs from "fs/promises";
import chokidar from "chokidar";
import axios from "axios";
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

export function startWatcher(publicPath: string) {
  const logger = log4js.getLogger("encode.service");
  logger.level = "trace";

  chokidar
    /* Watching the videosPath directory for ".mp4" new files that are added. */
    .watch(publicPath + "/**/*.mp4", {
      ignoreInitial: true,
      alwaysStat: true,
    })
    .on("add", (path: string) => {
      ffmpeg.ffprobe(path, async (err, metadata) => {
        if (err) logger.error(err);

        if (metadata.format.format_name?.includes("mp4")) {
          logger.info(
            "New video uploaded :",
            path.split("/").slice(-1).join("")
          );

          const fileName = path.split("/").slice(-1).join("");
          const currentResolution = metadata.streams[0].height as number;
          const missingResolutions = [1080, 720, 480, 360, 240, 144].filter(
            (resolution) => resolution <= currentResolution
          );
          const [userId, videoId] = getIds(path, publicPath);

          for (const resolution of missingResolutions) {
            const outputFolder = [publicPath, userId, videoId, resolution].join("/");

            await createVideoFolder(outputFolder);

            const outputPath = [outputFolder, fileName].join("/");

            /* Encoding the video and then patching the video with the new format and file. */
            encodeVideo(
              path,
              outputPath,
              resolution as 1080 | 720 | 480 | 360 | 240 | 144
            )
              .then(() => {
                const endpoint = process.env.API_URI + "/video/" + videoId;

                axios
                  .patch(endpoint, {
                    format: resolution,
                    file: outputPath,
                  })
                  .then(() =>
                    logger.info(
                      `${outputPath.split("/").pop()} - ${resolution}p uploaded`
                    )
                  );
              })
              .catch((e) => logger.error(e));
          }
        }
      });
    });
}

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
  await fs.mkdir(videoFolder, {
    recursive: true,
  });
}

export async function encodeVideo(
  videoPath: string,
  outputPath: string,
  resolution: 1080 | 720 | 480 | 360 | 240 | 144
) {
  const logger = log4js.getLogger(outputPath.split("/").pop());
  logger.level = "trace";

  try {
    return await new Promise<void>((resolve, reject): void => {
      ffmpeg(videoPath)
        // * output path
        .output(outputPath)

        // * resolution target
        .size(`?x${resolution}`)

        // * event listeners
        .on("error", (err) => {
          logger.error(err);
          reject(err);
        })
        .on("end", () => {
          logger.mark(`${resolution}p encoding finished`);
          resolve();
        })
        .on("start", () => {
          logger.mark(`${resolution}p encoding started`);
        })
        .run();
    });
  } catch (e) {
    logger.error(e);
  }
}
