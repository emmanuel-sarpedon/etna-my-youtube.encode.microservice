require("dotenv").config();
import log4js from "log4js";
const logger = log4js.getLogger("encode.service");
logger.level = "trace";
import * as service from "~/services/encode.services";

const videosPath = process.env.PUBLIC_PATH || "../public/videos/sources";

service.startWatcher(videosPath);

console.clear();
logger.info("Encode service started");
logger.info("Watching the videosPath directory for ".concat(videosPath));
