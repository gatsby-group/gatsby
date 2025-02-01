# Build

Learn what **build** means and how to set up a build for your Gatsby project.

## What is a Build?

A **build** is like making a finished product from parts. When you **build** your site, it changes from lots of small files into a nice, clean website with HTML, CSS, and JavaScript that you can put online.

There are a few ways to create a build:

- **On Your Computer**: You can build your site on your computer using a tool called the **Gatsby CLI**. After that, you can send your changes to where your website is hosted.
- **Using Gatsby Cloud**: If you use **Gatsby Cloud**, it has a special feature called **Gatsby Builds**. This helps you create builds easily.
- **With Deployment Services**: You can also use services like **AWS Amplify** or **Netlify** to help you build and send your site online.

For big teams or projects, using a **continuous deployment** approach is helpful. This means builds happen automatically when you make changes in a system called Git.

### Using Gatsby CLI

If you have a small team or project, you can use the command `gatsby build`. This command is part of the **Gatsby CLI**. To use it, you need to install the Gatsby CLI on your computer with a tool called **npm**.

To install it, open your terminal and type:

```shell
  npm install -g gatsby-cli
```

Once you install the Gatsby CLI, you can use commands like `gatsby new` to create a new site and `gatsby develop` to see your site as you build it.

When your site is ready to go live, run the `gatsby build` command. This makes your site ready for the internet! After that, you can use tools like SFTP or **rsync** to upload your files to your hosting provider.

### Learn More About Builds

- Check out the **Deploying and Hosting** section in the Gatsby docs.
- Learn how to enable super-fast **Distributed Builds** for Gatsby Cloud.
