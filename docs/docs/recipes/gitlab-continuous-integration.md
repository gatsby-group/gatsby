---
title: "Recipes: Continuous Integration on Gitlab"
tableOfContentsDepth: 1
---

Push your code to gitlab and automate your production build!

### Prerequisites

- Make sure you have the [Gatsby CLI](/docs/gatsby-cli) installed
- A [Gitlab](https://gitlab.com/) account 

### Directions
1. Create a gatsby site
```shell
gatsby new {your-project-name}
```
2. Change directory and start a development server
```shell
cd {your-project-name}
yarn develop
```

3. Stop your development server (`Ctrl + C` on your command line in most cases)

4. Create a `.gitlab-ci.yml` with the following content:

```
image: node:12.16.1

cache:
  paths:
    - node_modules/

stages:
  - build

build:
  stage: build
  script:
    - yarn
    - yarn build
```

3. `git push <you-remote-gitlab-repo>`
4. Check out your pipeline under the CI/CD option. 

### Additional resources

- See how you can develop this simple file into something more real world [Gitlab CI/CD Docs](https://docs.gitlab.com/ee/ci/README.html)
- Check this especially to learn how to make your newly build available for a next job - [Gitlab Job Artifacts Docs](https://docs.gitlab.com/ee/ci/pipelines/job_artifacts.html)

- [Getting started with GitLab CI/CD](https://gitlab.com/help/ci/quick_start/README)
