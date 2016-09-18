var gulp = require("gulp");
var del = require("del");
var ts = require("gulp-typescript");
var tsProject = ts.createProject("tsconfig.json", {
    typescript: require('typescript')
});
var paths = {
    "monaco-editor-sources-dev": ['node_modules/monaco-editor/dev/vs/**/*'],
    "monaco-editor-sources-min": ['node_modules/monaco-editor/min/vs/**/*'],
    "monaco-typescript-sources": ['node_modules/monaco-typescript/release/**/*']
};
var outputDirectory = "./dist";

gulp.task("compile", function () {
    return tsProject.src()
        .pipe(ts(tsProject))
        .js.pipe(gulp.dest(outputDirectory));
});

gulp.task("copy-monaco-editor-sources", function () {
    return gulp.src(paths["monaco-editor-sources-min"])
        .pipe(gulp.dest(outputDirectory + "/Script/vs"));
});

gulp.task("copy-monaco-typescript-sources", ["copy-monaco-editor-sources"], function () {
    return gulp.src(paths["monaco-typescript-sources"])
        .pipe(gulp.dest(outputDirectory + "/Script/vs/language/typescript"));
});

gulp.task("clean", function () {
    return del([outputDirectory]);
});

gulp.task("default", ["compile", "copy-monaco-typescript-sources"]);