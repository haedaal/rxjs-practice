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

interface LockStatus {
  free: boolean;
  lastLock: string;
  lastJob: string;
  fire: boolean;
}

let workerRequest = mouseEvents.pipe(
  combineLatest(workerLock),
  scan<[string, string], LockStatus>(
    (acc, v) => {
      let { free, lastLock, lastJob } = acc;
      let [event, lock] = v;
      if (lastLock != lock) {
        // new lock available
        if (lastJob != event) {
          console.log("case1");
          // fire
          return {
            free: false,
            lastLock: lock,
            lastJob: event,
            fire: true
          };
        } else {
          console.log("case2");
          // idle
          return {
            free: true,
            lastLock: lock,
            lastJob: lastJob,
            fire: false
          };
        }
      } else {
        // assert(lastEv != event);
        if (free) {
          console.log("case3");
          return {
            free: false,
            lastLock: lock,
            lastJob: event,
            fire: true
          };
        } else {
          console.log("case4");
          return {
            free: false,
            lastLock: lock,
            lastJob: lastJob,
            fire: false
          };
        }
      }
    },
    {
      free: true,
      lastLock: undefined,
      lastJob: undefined,
      fire: false
    }
  ),
  filter(v => v.fire),
  map(v => v.lastJob),
  share()
);

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
createAttachPush(workerRequest);
createAttachPush(workerJobStart);
createAttachPush(workerJobDone);
