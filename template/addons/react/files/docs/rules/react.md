# React

## Review scope

Apply this owner to React components, hooks, effects, context, and JSX. Data fetching, authorization, and persistence behind a component keep their own owners. `tooling/eslint-config/react.mjs` enforces the mechanical rules; this document owns the judgment the linter cannot make.

## Requirements

Render is pure: it derives values from props, state, and context and never writes to them, to refs, or to the outside world. Derive values during render instead of copying them into state from an effect. Keep one owner for each piece of state, and lift it only as far as its readers need.

An effect synchronizes a component with an external system: a subscription, a timer, a network connection, a browser API, or a non-React widget. Every effect that subscribes, listens, schedules, or opens a resource returns a cleanup that releases it, and its dependency list names every reactive value it reads. Fix a dependency warning by moving or restructuring the code, never by omitting the dependency. Strict Mode mounts components twice in development; an effect must behave correctly when it runs, cleans up, and runs again.

UI that is hidden but kept mounted stops its effects and global input handlers. Animations respect the user's reduced-motion preference and follow changes to it while the UI is visible.

Interactive elements are native controls or carry the role, name, and keyboard behavior of one. Images have a text alternative, or an empty one when decorative. Every form control has a label. Lists render with stable keys from the data, never array indexes for items that can move.

Loading, empty, error, and permission states are part of every component that fetches or depends on access. Error boundaries contain failures at a level where the rest of the page keeps working.
