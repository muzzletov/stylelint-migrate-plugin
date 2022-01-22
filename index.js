const stylelint = require("stylelint");
const fs = require('fs');
const path = require('path');

const ruleName = "plugin-migrate/use-variable-pattern";

const messages = stylelint.utils.ruleMessages(ruleName, {
    expected: "Expected $ variable name to have $. prepended"
});

const getFiles = (path) => {
    const files = []
    for (const file of fs.readdirSync(path)) {
        const fullPath = path + '/' + file
        if(fs.lstatSync(fullPath).isDirectory())
            getFiles(fullPath).forEach(x => files.push(file + '/' + x))
        else files.push(file)
    }
    return files
}

function readFile(filename) {
    let data = [];

    try {
        data = [...fs.readFileSync(filename, 'UTF-8').matchAll(/\$[a-zA-Z0-9]+/g)].map(value=>value[0]);
    } catch (err) {
        console.error(err);
    }

    return data;
}

function extractNamespace(filename) {
    return filename.substr(filename.lastIndexOf("/")+1).split(".")[0];
}

const variables = (()=>{
    const files = getFiles('.');

    let _variables = {};

    for(let i = 0; i < files.length; i++) {
        const filename = files[i];

        if(!filename.match(/\/[a-zA-Z]*\.scss$/g)) continue;
        const namespace = extractNamespace(filename);

        data = readFile(filename);

        for (datum of data) {
          _variables[datum] = namespace;
        }
    }

    return _variables;
})();

const IssueType = { IMPORT_STATEMENT:0, NAMESPACE_MISSING:1 };

module.exports = stylelint.createPlugin(
    ruleName, function(pattern, options) {
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

    root.walkDecls((decl) => {
      const { prop, value } = decl;
      let issueType;

      switch(prop[0]) {
        case "$":
            const namespace = variables[prop.slice(1)];

            if (!namespace) {
                return;
            }

            issueType = IssueType.NAMESPACE_MISSING;
            break;
        case "@":
            const _namespace = prop.startsWith("@import") || prop.startsWith("@use") && extractNamespace(value);

            if(_namespace) {
                namespaces.add(_namespace);
            }

            if(prop.startsWith=="@import") {
                issueType = IssueType.IMPORT_STATEMENT
                break;
            }
        default:
            return;
      }


      // If local or global variables need to be ignored
      if (
        (stylelint.utils.optionsHaveIgnored(options, "global") &&
          decl.parent.type === "root") ||
        (stylelint.utils.optionsHaveIgnored(options, "local") && decl.parent.type !== "root")
      ) {
        return;
      }

      stylelint.utils.report({
        message: messages.expected,
        node: decl,
        result,
        ruleName
      });
    })}});
