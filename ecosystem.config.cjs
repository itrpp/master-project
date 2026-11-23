module.exports = {
  apps: [
    {
      name: "master-project",
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production",
        PORT: 3020,
        HOSTNAME: "0.0.0.0",
      },
    },
  ],
};
