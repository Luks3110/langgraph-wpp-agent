/**
 * PM2 Ecosystem Configuration for Products Agent Service
 * 
 * This file configures the products-agent service to run in cluster mode
 * with PM2, taking advantage of all available CPU cores.
 */

module.exports = {
  apps: [
    {
      name: 'products-agent',
      script: './dist/index.js',
      instances: 'max', // Use all available CPU cores
      exec_mode: 'cluster', // Run in cluster mode
      watch: false, // Don't restart on file changes
      max_memory_restart: '500M', // Restart if memory usage exceeds 500MB
      env: {
        NODE_ENV: 'production'
      },
      env_development: {
        NODE_ENV: 'development',
        // Enable auto-restart in development
        watch: true,
        ignore_watch: ['node_modules', 'logs']
      },
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      combine_logs: true,
      // Graceful shutdown
      kill_timeout: 5000, // Give the app 5 seconds to gracefully terminate
      // Health checks
      max_restarts: 10,
      restart_delay: 4000,
      // Load balancing
      wait_ready: true, // Wait for the application to send 'ready' signal
      listen_timeout: 10000, // Wait 10s for the app to listen before considering it failed
    }
  ]
}; 
