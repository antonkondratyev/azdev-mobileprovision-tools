var fs = require('fs-extra');
var path = require('path');
var gulp = require('gulp');
var install = require('gulp-install');
var rename = require('gulp-rename');
var sourcemaps = require('gulp-sourcemaps');
var tsc = require('gulp-typescript');
var del = require('del');

var BUILD_DIR = '_build';
var TASKS_DIR = 'tasks';

var tasks = fs.readdirSync(TASKS_DIR).filter(taskName => fs.statSync(path.join(TASKS_DIR, taskName)).isDirectory());

var metadata = [
    '!**/node_modules/**/*',
    'vss-extension.json',
    'images/*.png',
    'LICENSE',
    'README.md',
    'tasks/*/{*.png,*.json,**/*.m}'
];

gulp.task('install_task_deps', done => {
    tasks.forEach(taskName => {
        gulp.src('package.json', { cwd: path.join(TASKS_DIR, taskName) })
            .pipe(install());
    });
    done();
});

gulp.task('install_prod_deps', done => {
    tasks.forEach(taskName => {
        gulp.src('package.json', { cwd: path.join(TASKS_DIR, taskName) })
            .pipe(gulp.dest(path.join(BUILD_DIR, TASKS_DIR, taskName)))
            .pipe(install({ production: true }));
    });
    done();
});

gulp.task('make_tasks', done => {
    tasks.forEach(taskName => {
        var tsProject = tsc.createProject(path.join(TASKS_DIR, taskName, 'tsconfig.json'));
        return tsProject.src()
            .pipe(sourcemaps.init())
            .pipe(tsProject())
            .pipe(sourcemaps.write('.', { sourceRoot: path.join(__dirname, TASKS_DIR, taskName), includeContent: false }))
            .pipe(gulp.dest(path.join(BUILD_DIR, TASKS_DIR, taskName)));
    });
    done();
});

gulp.task('copy_metadata', done => {
    gulp.src(metadata, { base: __dirname })
        .pipe(gulp.dest(BUILD_DIR));
    done();
});

gulp.task('clean_prod', () => {
    return del(`${BUILD_DIR}/**/{package*.json,tsconfig.json,*.map,*.d.ts}`);
});

gulp.task('clean', () => {
    return del(BUILD_DIR);
});

gulp.task('package', done => {
    // tfx extension create
    done();
});

gulp.task('set_env', done => {
    var taskName = process.argv.pop().split(path.sep).pop();
    var settingsPath = path.join(__dirname, '.vscode', 'settings.json');
    var settings = require(settingsPath);
    settings['task.name'] = taskName;
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    done();
});

gulp.task('install', gulp.parallel('install_task_deps', 'install_prod_deps'));
gulp.task('make', gulp.parallel('make_tasks'));
gulp.task('build', gulp.series('make', 'copy_metadata'));
gulp.task('default', gulp.series('clean', 'install', 'build', 'package'));