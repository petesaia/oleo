oleo.factory("taskFactory", function() {
  return function(props) {
    if (!props || !props.projectId) {
      throw new Error("A projectId is required to create a task.");
    }
    return {
      id: props.id || Math.random().toString(36).substr(2, 6),
      name: props.name || "",
      weight: props.weight || 0,
      creationDate: props.creationDate || Date.now(),
      projectId: props.projectId,
      rate: props.rate || 0,
      running: props.running || false,
      start: props.start || null,
      stop: props.stop || null,
      seconds: props.seconds || 0
    };
  };
});
