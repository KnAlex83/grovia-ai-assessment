9:15:30 PM: Failed during stage 'building site': Build script returned non-zero exit code: 2 (https://ntl.fyi/exit-code-2)
9:15:30 PM: Netlify Build                                                 
9:15:30 PM: ────────────────────────────────────────────────────────────────
9:15:30 PM: ​
9:15:30 PM: ❯ Version
9:15:30 PM:   @netlify/build 33.4.0
9:15:30 PM: ​
9:15:30 PM: ❯ Flags
9:15:30 PM:   accountId: 6840981c268bb039ae95749c
9:15:30 PM:   baseRelDir: true
9:15:30 PM:   buildId: 68409b2dbe74f23df6db0079
9:15:30 PM:   deployId: 68409b2dbe74f23df6db007b
9:15:30 PM: ​
9:15:30 PM: ❯ Current directory
9:15:30 PM:   /opt/build/repo
9:15:30 PM: ​
9:15:30 PM: ❯ Config file
9:15:30 PM:   /opt/build/repo/netlify.toml
9:15:30 PM: ​
9:15:30 PM: ❯ Context
9:15:30 PM:   production
9:15:30 PM: ​
9:15:30 PM: build.command from netlify.toml                               
9:15:30 PM: ────────────────────────────────────────────────────────────────
9:15:30 PM: ​
9:15:30 PM: $ echo 'No build needed - files are pre-built'
9:15:30 PM: No build needed - files are pre-built
9:15:30 PM: ​
9:15:30 PM: (build.command completed in 9ms)
9:15:30 PM: ​
9:15:30 PM: Functions bundling                                            
9:15:30 PM: ────────────────────────────────────────────────────────────────
9:15:30 PM: ​
9:15:30 PM: Packaging Functions from netlify/functions directory:
9:15:30 PM:  - export-data.js
9:15:30 PM: ​
9:15:30 PM: ​
9:15:30 PM: Dependencies installation error                               
9:15:30 PM: ────────────────────────────────────────────────────────────────
9:15:30 PM: ​
9:15:30 PM:   Error message
9:15:30 PM:   A Netlify Function failed to require one of its dependencies.
9:15:30 PM:   Please make sure it is present in the site's top-level "package.json".
​
9:15:30 PM:   In file "/opt/build/repo/netlify/functions/export-data.js"
9:15:30 PM:   Cannot find module 'pg'
9:15:30 PM:   Require stack:
9:15:30 PM:   - /opt/buildhome/node-deps/node_modules/@netlify/zip-it-and-ship-it/dist/runtimes/node/bundlers/zisi/resolve.js
9:15:30 PM: ​
9:15:30 PM:   Resolved config
9:15:30 PM:   build:
9:15:30 PM:     command: echo 'No build needed - files are pre-built'
9:15:30 PM:     commandOrigin: config
9:15:30 PM:     environment:
9:15:30 PM:       - NODE_VERSION
9:15:30 PM:     publish: /opt/build/repo/public
9:15:30 PM:     publishOrigin: config
9:15:30 PM:   functionsDirectory: /opt/build/repo/netlify/functions
9:15:30 PM:   headers:
9:15:30 PM:     - for: /*
      values:
        Referrer-Policy: strict-origin-when-cross-origin
        X-Content-Type-Options: nosniff
        X-Frame-Options: SAMEORIGIN
    - for: /assets/*
      values:
        Cache-Control: public, max-age=31536000, immutable
  headersOrigin: config
  redirects:
    - from: /api/*
      status: 200
      to: /.netlify/functions/:splat
    - from: /export-data.php
      status: 200
      to: /.netlify/functions/export-data
  redirectsOrigin: config
9:15:30 PM: Build failed due to a user error: Build script returned non-zero exit code: 2
9:15:30 PM: Failing build: Failed to build site
9:15:31 PM: Finished processing build request in 22.057s
