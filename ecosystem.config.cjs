/** PM2 config for production. Run: pm2 start ecosystem.config.cjs */
module.exports = {
  apps: [
    {
      name: "indiefilmer",
      script: "node_modules/.bin/next",
      args: "start -p 3001",
      cwd: __dirname,
      env: { NODE_ENV: "production" }
    }
  ]
};
