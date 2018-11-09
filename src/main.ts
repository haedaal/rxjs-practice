import * as rx from "rxjs";
import {
  filter,
  pairwise,
  throttle,
  throttleTime,
  share,
  skipUntil,
  combineLatest,
  delay,
  startWith,
  zip,
  withLatestFrom,
  scan,
  distinctUntilChanged,
  map,
  merge
} from "rxjs/operators";

class EventViewer {
  root: HTMLDivElement;
  events: any[] = [];
  constructor(private source: rx.Observable<any>) {
    this.root = document.createElement("div");
    this.root.className = "event-stream";
    source.subscribe(e => {
      let ev = document.createElement("div");
      ev.className = "event";
      ev.innerHTML = `${e}`;
      ev.style.right = `${0}%`;
      this.root.append(ev);
      this.events.push({ name: `${e}`, el: ev, time: Date.now() });
    });
  }
  update() {
    let currentTime = Date.now();
    if (this.events[0]) {
      if (currentTime - this.events[0].time > 5000) {
        let ev = this.events.shift();
        this.root.removeChild(ev.el);
      }
    }
    this.events.forEach(({ name, el, time }) => {
      el.style.right = `${(currentTime - time) / 50}%`;
    });
  }
}

let eventList: EventViewer[] = [];

rx.interval(60).subscribe(_ => {
  eventList.forEach(e => e.update());
});

let testbed = document.getElementById("testbed");

let createAttachPush = source => {
  let evViewer = new EventViewer(source);
  testbed.append(evViewer.root);
  eventList.push(evViewer);
};

let cc = 0;
let click = new rx.Subject<number>();

let workerLockSubject = new rx.Subject<number>();

document.onwheel = _ => click.next(cc++);

let mouseEvents = click.asObservable().pipe(map(v => `M_${v}`));

let workerLock = workerLockSubject.asObservable().pipe(
  startWith(0),
  map((v, i) => `L_${i}`)
);

let latestRequest = workerLock.pipe(
  withLatestFrom(mouseEvents),
  map(v => v[1]),
  share()
);

let initialRequest = mouseEvents.pipe(
  withLatestFrom(workerLock),
  distinctUntilChanged((x, y) => x[1] === y[1]),
  map(v => v[0]),
  share()
);

let workerRequest = latestRequest.pipe(
  merge(initialRequest),
  distinctUntilChanged(),
  share()
);

// let workerRequest = mouseEvents.pipe(
//   combineLatest(workerLock, (v1, v2) => v1),
//   distinctUntilChanged(),
//   share()
// );

let workerJobStart = workerRequest.pipe(
  zip(workerLock, (v1, v2) => v1),
  share()
);
let workerJobDone = workerJobStart.pipe(
  delay(1000),
  share()
);

workerJobDone.subscribe(_ => workerLockSubject.next());

createAttachPush(mouseEvents);
createAttachPush(workerLock);
createAttachPush(initialRequest);
createAttachPush(latestRequest);
createAttachPush(workerRequest);
createAttachPush(workerJobStart);
createAttachPush(workerJobDone);
