import axios from 'axios';
import Q from 'q';
import mongoose from 'mongoose';
import objectID from 'bson-objectid';
import shortid from 'shortid';
import User from '../models/user';
import Project from '../models/project';

const defaultHTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <script src="https://p5code.jb1.io/p5skia/0.74/canvaskit.js"></script>
    <script src="https://p5code.jb1.io/p5skia/0.74/p5skia.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.4.0/addons/p5.sound.min.js"></script>
    <link rel="stylesheet" type="text/css" href="style.css">
    <meta charset="utf-8" />
  </head>
  <body>
    <main></main>
    <script src="sketch.js"></script>
  </body>
</html>
`;

const defaultCSS = `html, body {
  margin: 0;
  padding: 0;
}
canvas {
  display: block;
}
`;

const clientId = process.env.GITHUB_ID;
const clientSecret = process.env.GITHUB_SECRET;

const headers = { 'User-Agent': 'p5js-web-editor/0.0.1' };

const mongoConnectionString = process.env.MONGO_URL_LOCAL;

console.log('mongo: ', mongoConnectionString);

mongoose.connect(mongoConnectionString, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});
mongoose.set('useCreateIndex', true);
mongoose.connection.on('error', () => {
  console.error(
    'MongoDB Connection Error. Please make sure that MongoDB is running.'
  );
  process.exit(1);
});

async function getCategories() {
  const categories = [];
  const options = {
    url:
      'https://api.github.com/repos/p5skia/p5.js/contents/examples/p5skia_examples?ref=p5skia',
    method: 'GET',
    headers: {
      ...headers,
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64')}`
    }
  };
  try {
    const { data } = await axios.request(options);
    data.forEach((metadata) => {
      let category = '';
      for (let j = 1; j < metadata.name.split('_').length; j += 1) {
        const cat = metadata.name.split('_')[j];
        category += `${cat} `;
      }
      if (category.trim()) {
        categories.push({ url: metadata.url, name: category.trim() });
      }
    });
    return categories;
  } catch (error) {
    throw error;
  }
}

async function getJSInProject(project) {
  const options = {
    url: `${project.url}`,
    method: 'GET',
    headers: {
      ...headers,
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64')}`
    },
    json: true
  };
  try {
    // console.log('request');
    const { data } = await axios.request(options);
    // console.log('data: ', data);
    let downloadURL = null;
    data.forEach((file) => {
      // console.log('dl: ', file.download_url);
      if (file.download_url.endsWith('.js')) {
        downloadURL = file.download_url;
      }
    });
    return downloadURL;
  } catch (error) {
    throw error;
  }
}

function getSketchesInCategories(categories) {
  return Q.all(
    categories.map(async (category) => {
      const options = {
        url: `${category.url}`,
        method: 'GET',
        headers: {
          ...headers,
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`
          ).toString('base64')}`
        },
        json: true
      };
      try {
        const { data } = await axios.request(options);
        const projectsInOneCategory = [];
        data.forEach(async (example) => {
          // console.log(example);
          let projectName;

          if (example.name.split('_')[1]) {
            projectName = `${category.name}: ${example.name
              .split('_')
              .slice(1)
              .join(' ')
              .replace('.js', '')}`;
          } else {
            projectName = `${category.name}: ${example.name.replace(
              '.js',
              ''
            )}`;
          }

          projectsInOneCategory.push({
            sketchUrl: '',
            projectName,
            url: example.url
          });
        });
        return projectsInOneCategory;
      } catch (error) {
        throw error;
      }
    })
  );
}

function getSketchContent(projectsInAllCategories) {
  return Q.all(
    projectsInAllCategories.map((projectsInOneCategory) =>
      Q.all(
        projectsInOneCategory.map(async (project) => {
          const options = {
            url: project.downloadURL,
            method: 'GET',
            headers: {
              ...headers,
              Authorization: `Basic ${Buffer.from(
                `${clientId}:${clientSecret}`
              ).toString('base64')}`
            }
          };
          try {
            const { data } = await axios.request(options);
            const noNumberprojectName = project.projectName.replace(
              /(\d+)/g,
              ''
            );
            if (noNumberprojectName === 'Instance Mode: Instance Container ') {
              for (let i = 0; i < 4; i += 1) {
                const splitedRes = `${
                  data.split('*/')[1].split('</html>')[i]
                }</html>\n`;
                project.sketchContent = splitedRes.replace(
                  'p5.js',
                  'https://p5code.jb1.io/p5skia/0.74/p5skia.js'
                );
              }
            } else {
              project.sketchContent = data;
            }
            return project;
          } catch (error) {
            throw error;
          }
        })
      )
    )
  );
}

async function addAssetsToProject(assets, response, project) {
  /* eslint-disable no-await-in-loop */
  for (let i = 0; i < assets.length; i += 1) {
    // iterate through each asset in the project in series (async/await functionality would not work with forEach() )
    const assetNamePath = assets[i];
    let assetName = assetNamePath.split('assets/')[1];
    let assetUrl = '';
    let assetContent = '';

    response.forEach((asset) => {
      if (asset.name === assetName || asset.name.split('.')[0] === assetName) {
        assetName = asset.name;
        assetUrl = asset.download_url;
      }
    });

    if (assetName !== '') {
      console.log(project.name, assetName);
      if (i === 0) {
        const id = objectID().toHexString();
        project.files.push({
          name: 'assets',
          id,
          _id: id,
          children: [],
          fileType: 'folder'
        });
        // add assets folder inside root
        project.files[0].children.push(id);
      }

      const fileID = objectID().toHexString();

      if (assetName.slice(-5) === '.vert' || assetName.slice(-5) === '.frag') {
        // check if the file has .vert or .frag extension
        const assetOptions = {
          url: assetUrl,
          method: 'GET',
          headers: {
            ...headers,
            Authorization: `Basic ${Buffer.from(
              `${clientId}:${clientSecret}`
            ).toString('base64')}`
          }
        };

        // a function to await for the response that contains the content of asset file
        const doRequest = async (optionsAsset) => {
          try {
            const { data } = await axios.request(optionsAsset);
            return data;
          } catch (error) {
            throw error;
          }
        };

        assetContent = await doRequest(assetOptions);
        // push to the files array of the project only when response is received
        project.files.push({
          name: assetName,
          content: assetContent,
          id: fileID,
          _id: fileID,
          children: [],
          fileType: 'file'
        });
        console.log(`create assets: ${assetName}`);
        // add asset file inside the newly created assets folder at index 4
        project.files[4].children.push(fileID);
      } else {
        // for assets files that are not .vert or .frag extension
        project.files.push({
          name: assetName,
          url: `https://p5code.jb1.io/assets/${assetName}`,
          id: fileID,
          _id: fileID,
          children: [],
          fileType: 'file'
        });
        console.log(`create assets: ${assetName}`);
        // add asset file inside the newly created assets folder at index 4
        project.files[4].children.push(fileID);
      }
    }
  }
  /* eslint-disable no-await-in-loop */
}

async function createProjectsInP5user(projectsInAllCategories) {
  const options = {
    url:
      'https://api.github.com/repos/P5Skia/p5.js/contents/examples/p5skia_examples/assets?ref=p5skia',
    method: 'GET',
    headers: {
      ...headers,
      Authorization: `Basic ${Buffer.from(
        `${clientId}:${clientSecret}`
      ).toString('base64')}`
    }
  };

  try {
    const { data } = await axios.request(options);
    const user = await User.findOne({
      username: process.env.P5SKIA_USERNAME
    }).exec();
    await Q.all(
      projectsInAllCategories.map((projectsInOneCategory) =>
        Q.all(
          projectsInOneCategory.map(async (project) => {
            let newProject;
            const a = objectID().toHexString();
            const b = objectID().toHexString();
            const c = objectID().toHexString();
            const r = objectID().toHexString();
            const noNumberprojectName = project.projectName.replace(
              /(\d+)/g,
              ''
            );
            if (noNumberprojectName === 'Instance Mode: Instance Container ') {
              newProject = new Project({
                name: project.projectName,
                user: user._id,
                files: [
                  {
                    name: 'root',
                    id: r,
                    _id: r,
                    children: [a, b, c],
                    fileType: 'folder'
                  },
                  {
                    name: 'sketch.js',
                    content:
                      '// Instance Mode: Instance Container, please check its index.html file',
                    id: a,
                    _id: a,
                    fileType: 'file',
                    children: []
                  },
                  {
                    name: 'index.html',
                    content: project.sketchContent,
                    isSelectedFile: true,
                    id: b,
                    _id: b,
                    fileType: 'file',
                    children: []
                  },
                  {
                    name: 'style.css',
                    content: defaultCSS,
                    id: c,
                    _id: c,
                    fileType: 'file',
                    children: []
                  }
                ],
                _id: shortid.generate()
              });
            } else {
              newProject = new Project({
                name: project.projectName,
                user: user._id,
                files: [
                  {
                    name: 'root',
                    id: r,
                    _id: r,
                    children: [a, b, c],
                    fileType: 'folder'
                  },
                  {
                    name: 'sketch.js',
                    content: project.sketchContent,
                    id: a,
                    _id: a,
                    isSelectedFile: true,
                    fileType: 'file',
                    children: []
                  },
                  {
                    name: 'index.html',
                    content: defaultHTML,
                    id: b,
                    _id: b,
                    fileType: 'file',
                    children: []
                  },
                  {
                    name: 'style.css',
                    content: defaultCSS,
                    id: c,
                    _id: c,
                    fileType: 'file',
                    children: []
                  }
                ],
                _id: shortid.generate()
              });
            }

            const assetsInProject =
              project.sketchContent.match(/assets\/[\w-]+\.[\w]*/g) ||
              project.sketchContent.match(/asset\/[\w-]*/g) ||
              [];

            try {
              await addAssetsToProject(assetsInProject, data, newProject);
              const savedProject = await newProject.save();
              console.log(
                `Created a new project in p5 user: ${savedProject.name}`
              );
            } catch (error) {
              throw error;
            }
          })
        )
      )
    );
    process.exit();
  } catch (error) {
    throw error;
  }
}

async function getp5skiaUser() {
  console.log('Getting p5skia user');
  try {
    const user = await User.findOne({
      username: process.env.P5SKIA_USERNAME
    }).exec();
    let p5User = user;
    if (!p5User) {
      p5User = new User({
        username: process.env.P5SKIA_USERNAME,
        email: process.env.P5SKIA_USER_EMAIL,
        password: process.env.P5SKIA_USER_PASSWORD
      });
      await p5User.save();
      console.log(`Created a user p5skia ${p5User}`);
    }
    // console.log('p5skia user: ', p5User);

    const projects = await Project.find({ user: p5User._id }).exec();
    console.log('Deleting old projects...');
    projects.forEach(async (project) => {
      try {
        await Project.deleteOne({ _id: project._id });
      } catch (error) {
        throw error;
      }
    });
    console.log('Get categories');
    const categories = await getCategories();
    console.log('Get sketch list in categories');
    const sketchesInCategories = await getSketchesInCategories(categories);
    // console.log('sketchesInCategories: ', sketchesInCategories);
    console.log('Get sketches URL');
    for (let c = 0; c < sketchesInCategories.length; c += 1) {
      // console.log('cat: ', c, sketchesInCategories[c]);
      for (let p = 0; p < sketchesInCategories[c].length; p += 1) {
        // console.log('proj: ', c, p, sketchesInCategories[c][p]);
        // eslint-disable-next-line no-await-in-loop
        const js = await getJSInProject(sketchesInCategories[c][p]);
        sketchesInCategories[c][p].downloadURL = js;
      }
    }
    console.log('Get sketches');
    const sketchContent = await getSketchContent(sketchesInCategories);
    console.log('Add Assets');
    const projectsInUser = createProjectsInP5user(sketchContent);
    return projectsInUser;
  } catch (error) {
    throw error;
  }
}

console.log('Examples-skia.js');
getp5skiaUser();
