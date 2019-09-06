const fs = require('fs');
const simpleVdf = require('simple-vdf');

const rawDir = './raw/';
const buildDir = './data/';

const regex = /{s:(.*?)}/g;

require.extensions['.txt'] = function (module, filename) {
  module.exports = fs.readFileSync(filename, 'utf8');
};

let dataObj = {};

const Tasks = [
  // Heroes
  {
    key: 'heroes',
    raw: 'scripts/units.json',
    dest: 'heroes.json',
    task: function() {
      const heroesFile = require(rawDir + this.raw);
      // remove # sign before every heroes' displayName + legendary property
      Object.entries(heroesFile).forEach(([key, hero]) => {
        hero.key = key;
        if (hero.displayName) {          
          hero.displayName = hero.displayName.replace('#', '')
        }
        if (hero.legendary) {
          hero.legendary.title = hero.legendary.title.replace('#', '')
          hero.legendary.description = hero.legendary.description.replace('#', '')
        }
      });
      dataObj[this.key] = heroesFile;
    }
  },
  // Alliances
  {
    key: 'synergies',
    raw: 'scripts/synergies.json',
    dest: 'synergies.json',
    task: function() {
      const synergiesFile = require(rawDir + this.raw);
      dataObj[this.key] = keyToLowerCase(synergiesFile);
    }
  },
  // Strings En
  {
    key: 'string_en',
    raw: 'panorama/localization/dac_english.txt',
    dest: 'dac_english.json',
    task: function() {
      const strFile = require(rawDir + this.raw);
      let strObj = simpleVdf.parse(strFile);
      strObj.dac = keyToLowerCase(strObj.dac);
      
      Object.keys(dataObj.synergies).map((synergy) => {
        dataObj.synergies[synergy].levels.forEach((lv, index) => {
          let strSynergyDesc = strObj.dac['dac_synergy_desc_' + synergy + '_' + (index+1)];
          let m;
          while ((m = regex.exec(strSynergyDesc)) !== null) {
            regex.lastIndex = -1; // Fix RegEx miss hp_regen matches in Scrappy Desc
            let values = dataObj.synergies[synergy][m[1]];
            let newVal = Array.isArray(values) ? values[index] : values;
            strSynergyDesc = strSynergyDesc.replace(m[0], newVal);
          }
          strObj.dac['dac_synergy_desc_' + synergy + '_' + (index+1)] = strSynergyDesc;
        })
      })

      dataObj[this.key] = strObj;
    }
  }
]

keyToLowerCase = (oldData) => {
  let key, keys = Object.keys(oldData).reverse();
  let n = keys.length;
  let newData = {};
  while (n--) {
    key = keys[n];
    newData[key.toLowerCase()] = oldData[key];
  }
  return newData;
}

async function build() {
  Tasks.forEach((task) => {
    task.task();
    fs.writeFileSync(buildDir + task.dest, JSON.stringify(dataObj[task.key]), 'utf-8');
  });

  let dataList = fs.readdirSync(buildDir);
  let indexFile = (
    'module.exports = {\n' +
    dataList.map((d, i, arr) => {
      return `\t${d.split('.')[0]}: require(__dirname + '${buildDir}${d}')`
    }).join(',\n')
    + '\n}'
  );
  fs.writeFileSync('./index.js', indexFile, 'utf-8');
}

build();