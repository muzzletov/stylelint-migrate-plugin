const stylelint = require("stylelint");
const fs = require('fs');
const path = require('path');
const postcss = require('postcss')
const ruleName = "plugin/use-variable-pattern";

const messages = stylelint.utils.ruleMessages(ruleName, {
  expected: (unfixed, fixed) => `Expected "${unfixed.replaceAll('"', "'")}" to be "${fixed.replaceAll('"', "'")}"`,
});

const getFiles = (path) => {
  const files = []
  for (const file of fs.readdirSync(path)) {
    const fullPath = path + '/' + file
    if (fs.lstatSync(fullPath).isDirectory())
      getFiles(fullPath).forEach(x => files.push(file + '/' + x))
    else files.push(file)
  }
  return files
}

function readFile(filename) {
  let data = [];

  try {
    data = [...fs.readFileSync(filename, 'UTF-8').matchAll(/\$[a-zA-Z0-9]+/g)].map(value => value[0]);
  } catch (err) {
    console.error(err);
  }

  return data;
}

function extractNamespace(filename) {
  return filename.substr(filename.lastIndexOf("/") + 1).split(".")[0];
}

const variables = (() => {
  const files = getFiles('.');

  let _variables = {};

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];

    if (!filename.match(/\/[a-zA-Z]*\.scss$/g)) continue;

    const namespace = extractNamespace(filename);

    data = readFile(filename);

    for (datum of data) {
      _variables[datum] = namespace;
    }
  }

  return _variables;
})();

module.exports.ruleName = ruleName;
module.exports.messages = messages;

module.exports = stylelint.createPlugin(
  ruleName, function (pattern, options, context) {

    return (root, result) => {
      const namespaces = new Set();
      const validOptions = stylelint.utils.validateOptions(
        result,
        ruleName,
        {
          actual: options,
          possible: {
            ignore: ["local", "global"]
          },
          optional: true
        }
      );

      if (!validOptions) {
        return;
      }

      root.walkAtRules((atRule) => {
        const { name, params } = atRule;
        const isImport = (name == "import" || name == "use");
        const _namespace = (isImport && typeof (params) == "string") && extractNamespace(params.replace(/^"(.+(?="$))"$/, '$1'));

        if (_namespace) namespaces.add(_namespace);

        if (name != "import") return;


        if (context.fix) {
          atRule.name = "use";
          return;
        }

        stylelint.utils.report({
          message: messages.expected(`@import ${params}`, `@use ${params}`),
          node: atRule,
          result,
          ruleName
        });
      });

      root.walkDecls((decl) => {
        const { prop, value } = decl;

        if(!value[0] === "$") return;
        
        const namespace = variables[value];

        if (!namespace) return;

        const expected = `${namespace}.${value}`;

        if (context.fix) {
          decl.value = expected;
          return;
        }

        stylelint.utils.report({
          message: messages.expected(`${prop}: ${value}`, `${prop}: ${expected}`),
          node: decl,
          result,
          ruleName
        });
      })
    }
  });
