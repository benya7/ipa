
const crypto = require("node:crypto");
export const empreinte = (x: string) => {
    return crypto.createHash("md5").update(x).digest("hex");
};
  