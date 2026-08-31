module.exports = {
  apps: [
    {
      name: 'qaqnus222',
      script: 'node_modules/.bin/next',
      args: 'start -p 3002',
      cwd: '/var/www/qaqnus222',
      env: {
        NODE_ENV: 'production',
        PORT: 3002,
      },
    },
    {
      name: 'qaqnus222-scheduler',
      script: 'node_modules/.bin/ts-node',
      args: '-P tsconfig.scripts.json src/bot/scheduler.ts',
      cwd: '/var/www/qaqnus222',
      env: {
        NODE_ENV: 'production',
        TZ: 'Asia/Tashkent',
      },
      max_restarts: 10,
      min_uptime: '30s',
      restart_delay: 5000,
    },
  ],
}
