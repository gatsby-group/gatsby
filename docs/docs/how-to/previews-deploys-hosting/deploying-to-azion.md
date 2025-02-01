---
title: Deploying to Azion
---

[Azion](https://www.azion.com/) is a fully integrated edge computing platform that delivers better performance, security, reliability, and efficiency for any workload. Our highly distributed architecture includes edge nodes strategically located within Internet Service Providers (ISPs) around the world, spanning across four continents, guaranteeing the fastest and most reliable connectivity.

The **Gatsby Boilerplate** helps you build a Single-Page Application (SPA) based on the Gatsby framework and run it directly on the edge of the network. By executing the boilerplate, several steps are encapsulated and automated, from repository management to edge deployment.

This template deploys an edge application, a domain, and a related GitHub repository to facilitate your access and management. It also contains a GitHub Action to enable a continuous integration workflow and keep your application and repository up to date.

The Gatsby Boilerplate uses Gatsby version **5.13.3** and React version **18.2.0.**

## Prerequisites

To use this template, you must:

- Create a free [Azion Console](https://console.azion.com/) user account.
- Have a [GitHub](https://github.com/signup) account to connect with Azion and create your new repository.
- Every push will be deployed automatically to this repository to keep your project updated.
- Enable [Application Accelerator](https://www.azion.com/en/documentation/products/build/edge-application/application-accelerator/) in your Azion account.
- To do so:
- Access [Console](https://console.azion.com/) > Account menu.
- Select the Billing & Subscriptions option.
- Select the Subscriptions tab.
- Activate the switch for the module.

> [!WARNING]
> If a module is activated, the execution of this template could generate usage-related costs. Check the [pricing page](https://www.azion.com/en/documentation/products/pricing/) for more information.

## Deployment

To start using this template, access [Azion Console](https://console.azion.com/) and click the **+ Create button** on the homepage.

This will open a modal where you can select **Templates** > **Gatsby Boilerplate** card.

In the configuration form, you must provide the information to configure your new application. Fill in the presented fields.

Fields identified with an asterisk are mandatory.

1. Connect Azion with your GitHub account.

- A pop-up window will open to confirm the installation of the Azion GitHub App, a tool that connects your GitHub account with Azion’s platform.
- Define your permissions and repository access as desired.

2. Select the **Git Scope** to work with.
3. Define a name for your edge application.

- The bucket for storage and the edge function will use the same name.
- Use a unique and easy-to-remember name. If the name has already been used, the platform returns an error message.

4. Click the **Deploy** button to start the deployment process.
   During the deployment, you’ll be able to follow the process through a window showing off the logs. When it’s complete, the page shows information about the application and some options to continue your journey.

> [!NOTE]
> The link to the edge application allows you to see it on the browser. However, it takes a certain time to propagate and configure the application in Azion’s edge locations. It may be necessary to wait a few minutes for the URL to be activated and for the application page to be effectively displayed in the browser.

[![Deploy Button](https://github.com/aziontech/azion-samples/raw/dev/static/button.png)](https://console.azion.com/create/gatsby/gatsby-boilerplate "Deploy with Azion")

## Additional resources

- [Managing Gatsby Boilerplate Template](https://www.azion.com/en/documentation/products/guides/gatsby-boilerplate/#managing-the-template)
- [How to deploy a blog based on Gatsby using a template](https://www.azion.com/en/documentation/products/guides/gatsby-blog-starter-kit/)
- [Azion Documentation](https://www.azion.com/en/documentation/)
