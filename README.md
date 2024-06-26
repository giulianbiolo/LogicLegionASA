<p align="center">
  <img src="https://github.com/giulianbiolo/asa_agent/blob/main/report/images/f1_style_logo_transparent.png" width="150" />
</p>
<p align="center">
    <h1 align="center">LLASA</h1>
</p>
<p align="center">
  Logic Legion Autonomous Agent for the Autonomous Software Agents UniTN Course
</p>
<p align="center">
	<img src="https://img.shields.io/github/license/giulianbiolo/asa_agent?style=flat&color=0080ff" alt="license">
	<img src="https://img.shields.io/github/last-commit/giulianbiolo/asa_agent?style=flat&logo=git&logoColor=white&color=0080ff" alt="last-commit">
	<img src="https://img.shields.io/github/languages/top/giulianbiolo/asa_agent?style=flat&color=0080ff" alt="repo-top-language">
	<img src="https://img.shields.io/github/languages/count/giulianbiolo/asa_agent?style=flat&color=0080ff" alt="repo-language-count">
<p>
<p align="center">
		<em>Developed with the software and tools below.</em>
</p>
<p align="center">
	<img src="https://img.shields.io/badge/JavaScript-F7DF1E.svg?style=flat&logo=JavaScript&logoColor=black" alt="JavaScript">
	<img src="https://img.shields.io/badge/tsnode-3178C6.svg?style=flat&logo=ts-node&logoColor=white" alt="tsnode">
	<img src="https://img.shields.io/badge/TypeScript-3178C6.svg?style=flat&logo=TypeScript&logoColor=white" alt="TypeScript">
	<img src="https://img.shields.io/badge/JSON-000000.svg?style=flat&logo=JSON&logoColor=white" alt="JSON">
</p>
<hr>

## 🔗 Quick Links

> - [📍 Overview](#-overview)
> - [📦 Features](#-features)
> - [📂 Repository Structure](#-repository-structure)
> - [🚀 Getting Started](#-getting-started)
>   - [⚙️ Installation](#️-installation)
>   - [🤖 Running asa_agent](#-running-asa_agent)
> - [🛠 Project Roadmap](#-project-roadmap)
> - [📄 License](#-license)

---

## 📍 Overview

This project is part of the master course "Autonomous Software Agents".
The primary goal of the project is to develop an autonomous agent using the Belief-Desire-Intention (BDI) architecture.
The agent is capable of picking up and delivering parcels to their destination both using a local pathfinder algorithm, in our case A*, and using a PDDL Solver online.
In addition, the agent is also capable of coordinating with another agent in a collaborative fashion to achieve this goal.

---

## 📦 Features

<code>► INSERT-TEXT-HERE</code>

---

## 📂 Repository Structure

```sh
└── asa_agent/
    ├── LICENSE
    ├── README.md
    ├── agent.js
    ├── config.ts
    ├── single.ts
    ├── index.ts
    ├── jsconfig.json
    ├── package.json
    ├── report
    │   ├── images
    │   │   ├── logo.png
    │   │   ├── logo_transparent.png
    │   ├── report.pdf
    │   ├── report.typ
    │   ├── template.pdf
    │   └── template.typ
    └── src
        ├── agent.ts
        ├── args.ts
        ├── communication.ts
        ├── conf.ts
        ├── intention.ts
        ├── options.ts
        ├── pddl.ts
        ├── plan.ts
        ├── planner
        │   ├── Beliefset.ts
        │   ├── PddlAction.ts
        │   ├── PddlDomain.ts
        │   ├── PddlExecutor.txt
        │   ├── PddlOnlineSolver.ts
        │   ├── PddlProblem.ts
        │   ├── domain.pddl
        │   ├── pddl_executor.ts
        │   └── pddl_planner.ts
        ├── types.ts
        └── utils.ts
```

---

## 🚀 Getting Started

***Requirements***

Ensure you have the following dependencies installed on your system:

* **TypeScript**: `version 5.4.5`

### ⚙️ Installation

1. Clone the asa_agent repository:

```sh
git clone https://github.com/giulianbiolo/asa_agent
```

2. Change to the project directory:

```sh
cd asa_agent
```

3. Install the dependencies:

```sh
npm install
```
And then install Bun following the official documentation at [Bun](https://bun.sh/)

4. Setup the config file:

First of all download and execute the [Deliveroo.js](https://github.com/unitn-ASA/Deliveroo.js) virtual environment.
Then set the constants in the config.ts file accordingly.
Finally if you want to use the A* pathfinder comment out the "usePDDL" argument in the index.ts or single.ts files.

### 🤖 Running asa_agent

Use the following command to run the single agent:

```sh
bun run single.ts
```

And the following to run the two collaborative agents:

```sh
bun run index.ts
```

## 🛠 Project Roadmap

- [X] `► Implement Blind Pathfinder`
- [X] `► Implement A* Pathfinder`
- [X] `► Finalize Working Single Agent`
- [X] `► Implement PDDL Based Planner`
- [X] `► Implement Communication between Agents`
- [X] `► Finalize Working Collaborative Agents`
- [X] `► Implement Basic Multi-Agent Plans`
- [ ] `► Implement More Complex Multi-Agent Plans`
- [ ] `► ...`

---

## 📄 License

This project is protected under the [GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html) License.
For more information, refer to the LICENSE file in the repository root.


[**Return**](#-quick-links)

---
