# static-assets

Static assets and standalone sites for Bitcredit projects.

Published content is isolated by deployment:

- [`static/`](static/) is the deployment root for the existing static-assets domain. Configure that Cloudflare Pages project with root directory `static` and build output directory `.`.
- [`sites/`](sites/README.md) contains independent website deployment roots.

The repository root must never be used as a deployment root or build output directory. See the [sites deployment guide](sites/README.md) for the wallet Universal/App Link configuration and validation steps.
