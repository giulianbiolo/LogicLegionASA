#import "template.typ": *
#import "@preview/algo:0.3.3": algo, i, d, comment, code

#show: project.with(
  title: "Autonomous Software Agents\nLogicLegion - Final Report",
  authors: (
    "Giulian Biolo - 248726",
    "giulian.biolo@studenti.unitn.it",
  ),
  date: "10 Giugno, 2024",
)


#show raw: set text(size: 8pt)
/*
=== Report
- Explain what you have done and how (max 10 pages – pdf file)
- Use whatever you think it is important to describe your work (diagrams, piece of code, data, experiments, tests, etc)

=== Validation and test
- Use scenarios of Challenge 1 and Challenge 2 to validate and test your software
- Validate and test your Agent A in the scenarios of Challenge 1
- Validate and test your team in the three scenarios of Challenge 2

== Agent A
Agent A should be able to collect packages and deliver them into the delivery zones.

Its basic requirements are:
- Sense the environment
- Revise Beliefs
- Revise Intentions
- Elaborate plans using PDDL-based planner

== Agent A1+A2
- Explicit a game strategy and coordination mechanisms (to be described in the report)
- Agent A1 and A2 should be able to:
- Exchange information about the environment (e.g., packages and other agents’ position)
- Exchange information about their mental states to coordinate their activities
- Exchange information about their mental states to elaborate multi-agent plans

#line(length: 100%)
*/

// Here begins the actual report
/*
= Table of Contents

== Introduction
- Project Overview
- Objectives

== Background
- Overview of Agent-Based Systems
- Introduction to PDDL (Planning Domain Definition Language)

== Design and Implementation of Agent A
- Architecture of Agent A
  - System Architecture Diagram
  - Components and Their Functions
- Algorithms and Techniques Used
  - Sensing Algorithm
  - Belief Revision Algorithm
  - Intention Revision Algorithm
  - PDDL-Based Planning
- Code Snippets and Explanation

== Validation and Testing of Agent A
- Testing Scenarios for Challenge 1
  - Description of Scenarios
  - Test Cases and Results
- Analysis of Agent A’s Performance
  - Metrics Used for Validation
  - Performance Analysis

== Design and Implementation of Agent A1 and Agent A2
- Functional Requirements
  - Game Strategy and Coordination Mechanisms
  - Information Exchange Protocols
    - Environment Information
    - Mental States Information
- Architecture of Agent A1 and Agent A2
  - System Architecture Diagram
  - Coordination Mechanisms
- Algorithms and Techniques Used
  - Communication Algorithms
  - Multi-Agent Planning Algorithms
- Code Snippets and Explanation

== Validation and Testing of Agent A1 and Agent A2
- Testing Scenarios for Challenge 2
  - Description of Scenarios
  - Test Cases and Results
- Analysis of Agent A1 and A2’s Performance
  - Metrics Used for Validation
  - Performance Analysis

== Experiments and Results
- Experimental Setup
- Data Collection and Analysis
- Discussion of Results

== Challenges and Limitations
- Challenges Faced During Implementation
- Limitations of the Current Approach

== Conclusion and Future Work
- Summary of Achievements
- Potential Improvements
- Future Research Directions

== References
- Cited Literature and Resources

== Appendices
- Additional Diagrams
- Complete Code Listings
- Additional Data and Test Results
*/

== Project Overview & Objectives:
=================================
The following is a report regarding the detailed steps taken to implement and execute an autonomous agent capable of collecting packages and delivering them to the designated delivery zones in the Deliveroo.js simulation environment. It is divided in two main parts:
- The first part focuses on the implementation and testing of Agent A, which is responsible for achieving it's tasks autonomously.
- The second part focuses on the implementation and testing of the code necessary to coordinate two agents, with same underlying engine as the first part agent, such that they can work together to achieve the same goals.

== Design and Implementation of Agent A:
========================================
The basic model around which the entire codebase is designed is the BDI Model.\
Every world sensing events executes a belief revision step, which updates the agent's beliefs about the world.\
The Agent implements a loop that continously updates the actions it could perform (Options) and pushes the actions it decides to perform (Intentions) to the execution queue.\
Every time a new event gets sensed by the agent, the method: `generateOptions()` is called.\
The following is a diagram of the engine's flow:
#image("images/bdi_engine_flow.png")
=== Algorithms & Techniques Used:
