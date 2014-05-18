oleo.directive("project", ['projectService', function(projectService) {
  function link(scope, el, attrs) {

    // When false confirmation box shows.
    scope.hideDelete = true;

    // Remove a project.
    scope.remove = function(proj) {
      if (proj.current) { // If current, unset user's current.
        scope.$parent.user.currentProject = null;
      }
      projectService.remove(proj);
    };

    // On Project select.
    scope.selectProject = function(proj) {
      scope.$parent.projects.forEach(function(p) { // Uncurrent previous projects.
        p.current = false;
      });
      proj.current = true;
      scope.$parent.user.currentProject = proj;
      scope.save();
    };
    
    // Pass in a save function.
    scope.save = projectService.save.bind(projectService);
  }
  return {
    link: link,
    restrict: "A",
    scope: {
      project: "="
    },
    templateUrl: "../partial/project.html"
  };
}]);
