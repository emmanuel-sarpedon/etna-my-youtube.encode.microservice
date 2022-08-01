import axios, { AxiosResponse } from "axios";

require("dotenv").config();
import log4js from "log4js";
import chokidar from "chokidar";
const logger = log4js.getLogger("encode.service");
logger.level = "trace";
import * as service from "~/services/encode.services";

import ffmpeg from "fluent-ffmpeg";
if (process.env.FFMPEG_PATH) ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
if (process.env.FFPROBE_PATH) ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);

const videosPath = process.env.PUBLIC_PATH || "../public/videos/sources";

chokidar
  /* Watching the videosPath directory for ".mp4" new files that are added. */
  .watch(videosPath + "/**/*.mp4", {
    ignoreInitial: true,
    alwaysStat: true,
  })
  .on("add", (path: string) => {
    ffmpeg.ffprobe(path, async (err, metadata) => {
      if (err) logger.error(err);

      if (metadata.format.format_name?.includes("mp4")) {
        logger.info("New video uploaded :", path.split("/").slice(-1).join(""));

        const fileName = path.split("/").slice(-1).join("");
        const currentResolution = metadata.streams[0].height as number;
        const missingResolutions = [1080, 720, 480, 360, 240, 144].filter(
          (resolution) => resolution <= currentResolution
        );
        const [userId, videoId] = service.getIds(path, videosPath);

        for (const resolution of missingResolutions) {
          const outputFolder = [videosPath, userId, videoId, resolution].join(
            "/"
          );

          await service.createVideoFolder(outputFolder);

          const outputPath = [outputFolder, fileName].join("/");

          /* Encoding the video and then patching the video with the new format and file. */
          service
            .encodeVideo(
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
                .then((res: AxiosResponse) => logger.info(res.data));
            })
            .catch((e) => logger.error(e));
        }
      }
    });
  });
