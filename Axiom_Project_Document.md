# Axiom — Concept & Features

*An AI-assisted study and course management platform for students juggling multiple courses toward multiple exams.*

In this MD file i will be documenting all the instructions for each build and this file must be followed for all the instructions-
after finishing each build make sure to instruct me on how to open and test the app we are about to build

---

## 1. The Problem

Students taking several courses at once have to manage materials, previous-year questions (PYQs), exam dates, note-taking, self-testing, and study scheduling independently for each course, with nothing coordinating between them. The result: study time gets allocated by instinct and anxiety rather than by what actually needs attention, notes are static documents that don't adapt when something's confusing, and self-testing (when it happens at all) is disconnected from what gets studied next.

## 2. The Concept

Axiom is a single place a student brings their entire academic term into. They upload what they already have — materials, PYQs, exam dates — for each course, and the app turns that raw material into an organized, adaptive study system: notes that can be drilled into on demand, practice tests generated from real past questions, and a schedule.

The core philosophy: the student shouldn't have to manually re-derive "what should I study today, and in what order" every single day across four or five separate course workloads. The app carries that coordination burden so studying time goes to what needs it.

## 3. What Makes This Different

Individual pieces of this — AI-generated notes from documents, AI-generated quizzes, visual mind-map-style notes — already exist in general-purpose tools like NotebookLM. That's worth being upfront about. What's different is the shape of the whole thing, not any single piece:

- **General AI note/document tools have no concept of "course," "semester," "exam date," or "lesson sequence."** They're built to summarize whatever you throw at them. Axiom is built around the specific structure of being a student with several classes converging on several deadlines.
- **A generic AI mind-map is a static, one-time-generated overview of a whole document, identical for every user who uploads it.** Axiom's canvas is not pre-generated — it starts essentially blank for each lesson and grows only from the specific things *this* student personally found confusing, one question at a time. It's a record of a student's own curiosity trail, not a summary.
- **Nothing in this space closes the loop between testing and studying.** Quiz performance elsewhere is just a score. Here, what a student gets wrong on a practice test feeds directly back into what the schedule prioritizes next — the test isn't just assessment, it's an input to planning.
- **Nothing coordinates *across* courses.** Every study tool treats one course, one document set, or one deadline in isolation. Axiom's scheduling looks at the whole term at once.

## 4. The Experience, Walked Through

**Getting started:** a student signs up, creates a semester, and adds their courses to it — each with a name, code. Courses appear as cards inside their semester.

**Bringing in material:** inside a course, the student uploads whatever they have — lecture slides (pdt, pptx, images, doc etc), and previous year's exam questions. There's no expectation of pristine, organized input; this is meant to absorb whatever a student actually has lying around.

**Studying a lesson:** opening a lesson drops the student into notes generated from the relevant material — organized, exam-focused, broken into sections with key terms and examples pulled out. If something in the notes doesn't make sense, the student selects it and asks for more — a new, connected explanation appears right next to what confused them, with its own example. Over the course of a study session, this builds into a personal, spatial map of exactly where a student's understanding needed reinforcing — something a static PDF or a generic AI summary can't produce, because it's shaped by the individual student's own points of friction, not a generic overview.

**Testing what was just learned:** after working through a lesson, the student can take a short practice test built from that course's actual previous year questions, matched to the topics just covered. This isn't a generic quiz — it's grounded in the same kind of questions that will show up on the real exam.

**Seeing the whole picture:** on the dashboard, the student sees "this week" — a schedule spanning every active course at once, not just one. It weighs how close each exam is and, over time, which topics the student has actually struggled with on practice tests, and adjusts what gets prioritized.

**Staying focused and studying together:** a built-in Pomodoro timer supports focused individual sessions, and a shared whiteboard lets a study group work through material together — deliberately without voice or video, so it stays a lightweight, low-pressure space rather than one more call to coordinate and show up to.

**Finding things again:** a single search bar reaches across every note, every canvas explanation, and every uploaded material across all of a student's courses — so a half-remembered explanation from three weeks ago in a different course is never more than a search away.



For the frontend design - I am giving you freedom to design the frontend yourself, make it look minimal, useful and clean and beautiful. Make sure the frontend design for this feature AND for the upcoming features is super consistent, create a design guide if necessary and always keep that in mind.

What tech will we be using ? my proposed ones - 

This is a software we are building for a small software engineering project. For now, build it like a webapp
use TailwindCSS, Python(FastAPI) for backend, the AI API is for now gemini lets say, the free version, but we might need to change it in future if it doesnt prove effective so keep that in mind, for databse im thinking SQLite (FTS5) ,

After finishing building the entire webapp, (creating it feature by feature), if i think its enough then i will tell you to package the entire thing in a desktop shell using electron and REACT but leave that for now,thats later for now build it like a webapp.

For now, i want you to skip the entire registration, login flow and just get straight to building the features, we can add the reg + login authentication flow after the features work properly. But we will add that later. The proper database designing according to the needs of the context is very important so feel free to ask me non technical questions if you need clarity. 

THE FIRST FEATURE BUILD:

Now, I am going to describe the first and the most important of the features that we are going to be building right now. Firstly, I'm going to detail out every single step of the feature and then I want you to explain to me first and how you're planning on executing this build and how we can test it in each step so that I want to do it like we break the entire process down into multiple steps and after finishing the first step we tested and if it's okay then we go to the next step. This way we don't have to. You know wait for the entire thing to finish and then if something goes wrong we are scrambling around searching for what went wrong.  



So the first thing would be the notes generation and producing a proper PDF and then showing that PDF in the front end. So a student would basically create a course with basic course information. And then they will upload all the study materials that they have currently, those uploaded files would then be sent to the AI API, The AI will will analyze all those files, take its time, and first it would figure out what concepts are there in the materials. So if there's multiple concepts across all the materials, it would list out first. All the concepts that are there and based on those concepts will create very highly detailed PDF notes. In this part, the AI will send back a latex or tex code of the corresponding concept notes and in the back end of the software the tex codes will be converted into PDF and they're shown in the front end. The list of concepts is important because right after this step, the user or the student will be prompted to create exams that they have throughout the semester for this particular course so they can have multiple Class Tests. They will have an option to select how many class tests they have. They will have an option to create an exam and then they can call it midterm or CT or finals or whatever and after creating the exam, they can see the list of concepts that the AI generated before, they can tick off the concepts that are in that particular exam from that list. After this step, student will be prompted to submit previous year. Questions or previous past question papers that they have. It could be PDF. It could be images. So my idea was to make sure that for each course there will be multiple lessons right? And those lessons will have the PDF as the source material for learning and after each lesson after finishing each lesson basically or after reading its PDF, they can take a quiz by pressing a button called start quiz or something like that which will give them an exam that they can take to check if they've learned all the concepts properly. Okay, so what I'm thinking now right now is that it could be better if the notes generation by the AI also combined with the analysis of previous year questions so that the notes are generated in such a way that they also teach the concepts at the same in the same PDF. At the same time, they also have practice problems that specifically correspond to what actually comes in the exam from that concept. So the PDF teaches the concept and then there is a practice problem or an example that actually is similar to what comes in the exam. So I'm now thinking that it would be better if we do the previous year questions submission before PDF generation. Okay say now we have the PDFs and we have also generated the quizzes (for this build dont build the quiz generation part, just the pdf part with the examples, previous questions uploading included). Now it is time to keep the exam date in mind and create lessons that would correspond to a schedule, right? So today I have to learn these lessons,  so this is the schedule creating part. So just keep the schedule creating part in mind for now we're going to be working on the entire notes generation for now and we so make sure we can actually do that first and then we can and then we will proceed to lesson and schedule generation along with quiz generations that a user can click after they finish reading materials of a lesson.

The AI API returning TEX code is important because the course materials can be scientific so tex codes and then compiling them to pdf would make it much easier i believe. 

Okay another thing is , the AI will have to give code for multiple PDFs right ? isn't that a problem ? like if the AI generates multiple PDF latex codes in one go then im assuming each tex code will be 
super small and not useful at all, which is a problem because i need each concept PDF to be super detailed. So i need a way to make sure the AI uses multiple prompts to generate multiple PDF codes and sends them back in proper way so the software backend can identify which code is for which and then compile that into PDF with proper names, so the pdfs can be used as source materials. For this part, lets skip the "schedule lessons according to exam date part " and just build this system first. For now, lets put all the source materials in one lesson. Later in the second feature building we can take the exam dates into accounds along with what concepts are in the exams to create a proper schedule and organize the pdfs into lessons, and what lessons should be taught in what day 
For now also skip the exam generation part. FOR NOW JUST FOCUS ON THE start to the showing of PDF in the frontend. When i say the frontend, (the frontend design must be minimal design but should look cool and beautiful like the noteebookLM ui or claude UI ) here is what i imaagine, the main focus of dashboard is probably a beautiful cards of todays lessons, or weekly lessons. When they click a lesson the entire application window will split in two, the left side will have the lesson lists for today, the right side will be a window ( which in a later feature we will turn that into an infinite canvas just like in miro) and in this window the Pdf preview will show first, and when the user clicks the pewview, the pdf will transition / become scrollable, and when the user presses a cross button on the corner or presses esc then it goes back to only the preview, keep in mind these changes are happening on the right side window only. 

another thing is, the latex must follow a structure for every kind of note, otherwise every kind of note pdf will be different. the content will obviously be different depending on the concept, but the overall design / structure of the pdf should be predefined. For example, on top it should say the name of the topic, and then the important content / tex code send by AI and then after each concept teaching there must be practice questions / example questions that are crafted according to the previous year questions. thats how the entire pdf should look. So we also need to carefully tell the AI API what to do, that prompt is super important.

Context of each files is also important, it is important that the submitted / received files from AI API related to one course does not get mixed up in another course. Same goes for concept list etc..So this context of data, files etc are important to keep in mind. 

I dont want any extra gibberish on the front end part, only the things that are relevant to the user using the application.  during the build of each feature, like this one, i want you to break down the entire building processes into as little testable steps as possible so that after each step is done i can verify if its correct USING THE FRONTEND. The backend stuff is for you to deal with here. (but make sure you explain the important processes to me of the backend while planning)

The dashboard or some window in the frontend to view all existing courses, created semesters and all relevant info like that. I dont want any useless buttons in the frontend, all buttons must have a purpose and well documented so that if its not working i can identify and tell you what to do with it. 

I wonder how to deal with the scenario when a user wants to add more materials after already the notes have been generated, maybe they got more materials or maybe they want to remove a material, do we go over all the pdf generation process again ? there needs to be a smart way to deal with it. For this build lets not worry about that but for the next build we need to keep this in mind for now. 

Also, we need each build to be somewhat independent from the previous one. For example, in the next build i dont want you to edit and mess with the previous builds, you can add code and stuff but messing with the previous build seems like a way to break the existing features as well. So keep that in mind.

There should be a way to view the names of already submitted materials. There should be a way to remove a course and add courses (obviously).

If for the backend APIs some info is needed, for example if account info or some code is needed for the Gemini API to work, then ask for it to me plainly and i'll give it you and then just put that in the place where it needs to be. Id prefer not to go through backend files to put in stuff. 

How the Direct Gemini File Pipeline Works
Direct File Upload (client.files.upload)

When a student uploads slides or past question papers (PDFs, PPTX, images) to FastAPI, the backend sends those files straight to Gemini's File API. Gemini stores them and returns a file URI handle.

Concept Extraction Prompt

FastAPI calls Gemini passing the file URIs: "Analyze these uploaded materials and return a JSON array of all key concepts." Gemini inspects the intact documents and returns the concept list.

Targeted LaTeX Generation

When generating notes for a specific concept, FastAPI passes the concept name alongside the original uploaded file URIs to Gemini: "Using the attached course files and past questions, write detailed LaTeX notes for [Concept Name]."

The Only 3 Guardrails You Still Need
Even when uploading raw files directly, three operational constraints remain:

Input vs. Output Limits: Gemini can read massive inputs (1M+ tokens), but its output response is capped at ~8,192 tokens per request. Generating LaTeX one concept per prompt call ensures code doesn't get cut off mid-page.

LaTeX Syntax Validation: LLMs occasionally output unescaped special characters (like %, _, or &) inside standard text prose. Running a quick backend regex scan on Gemini's LaTeX snippet before sending it to tectonic or pdflatex prevents compiler crashes.

Rate Limits (RPM): On the free tier, making back-to-back API calls too fast triggers rate limit errors. Adding a small asyncio.sleep(2) delay between concept note generation calls resolves this completely.

To maintain 100% teacher fidelity without blowing past Gemini token caps or output limits, the pipeline uses Targeted Page-Mapping.

Step 1: Concept Extraction with Slide Coordinates

During the initial analysis pass, Gemini scans the uploaded materials and returns the concept list along with the exact file and page/slide ranges where those concepts are taught.

Example Output:

Concept: B+ Tree Deletion & Rebalancing

Source Locations: Lecture_05_Index.pdf (Pages 12–18) + Midterm_2024_PYQ.pdf (Page 2, Question 3a)

Step 2: Targeted High-Fidelity Context Passing

When generating LaTeX notes for "B+ Tree Deletion", do not send a generic summary, and do not send the entire 200-page semester deck. Slice out and attach only the 8 relevant source pages directly to the Gemini API call.

This accomplishes two critical things:

Zero Context Loss: Gemini gets the raw, intact slide pages containing the teacher's exact diagrams, formulas, step-by-step solution sequences, and specific variable naming conventions.

Optimal Token Footprint: Sending 8 pages (~4,000 tokens) instead of 200 pages (~100,000 tokens) keeps the prompt lightweight, fast, and well within Gemini's free-tier limits.
Other Problems You Will Face

PDF Inline Preview Blocking (Browser Headers): Browsers often force PDF files to download instead of rendering them inside an <iframe> or object preview window.

Solution: In FastAPI, return FileResponse with headers={"Content-Disposition": "inline"} and media_type="application/pdf".

Dirty Filenames & OS Command Subprocesses: User-uploaded files often contain spaces, parenthesis, or special symbols (e.g., Class 01 (Final) #2.pdf), which crash command-line tools like tectonic during compilation commands.

Solution: Always assign internal UUIDs to files stored on disk (e.g., file_89f12a.pdf) while storing the original display name strictly in SQLite metadata.

LaTeX Package Missing Dependencies: If Gemini introduces arbitrary LaTeX packages (like complex tikz diagrams or rare font packages) that aren't pre-installed in your local compiler environment, tectonic or pdflatex will fail.

Solution: Define a strict, standard preamble on the backend containing pre-imported packages (amsmath, amssymb, graphicx, enumitem, xcolor, tcolorbox). System-prompt Gemini to never output \usepackage{...} calls.

Cross-Course Data Leakage: As you add more courses, search or prompt contexts can accidentally pull past-year questions from Course A when generating notes for Course B.

Solution: Enforce strict foreign-key database constraints and ensure every file query is explicitly scoped by WHERE course_id = ?.

Scheduling Constraint Blowouts (Upcoming Feature): When calculating daily study schedules based on exam dates and quiz failures, simple algorithms often assign unrealistic workloads (e.g., 10 hours of study on a single day).

Solution: Set strict constraint boundaries (e.g., maximum 2 hours or 2 concepts per course per day) in the scheduling engine logic.


Use Opus 5 for planning this entire build. And then use Sonnet for the coding. 

 Subagents : Plan to use subagents properly for each aspect of the build so the build is clean and well organized.
 
THERE MAY BE MORE PROBLEMS OR THINGS THAT I MIGHT MISS THINGS THAT MAY CAUSE ERRORS , I WANT YOU TO THINK ABOUT THEM, AND BUILD THIS IN EACH STEP IN SUCH A WAY THAT ALL ERRORS ARE IDENTIFIABLE



SECOND BUILD : 

Now we deal with the part of creating exams (the student can enter exam name, exam of which course, starting date of study, finish within all that etc), assigning topics to each exam, and then creating a schedule based on those exams. For example what to study each day, thus what lessons to cover each day. I'm wondering which approach would be better for this, I am thinking about the following approach for this routing making and scheduling : we send the exam dates and the starting and ending dates and the topic lists to the Gemini API and the API does the calculation for us and gives back a schedule, or should we hard wire a logic function in the backend for schedule creation, i think giving it to gemini api is the better choice but i want you to think it through and recommend the better choice. Now how should the scheduling look in the frontend, well i'm guessing firstly when someone opens the app and logs in ( we haven't made the auth/login stuff yet) the first thing they should see in the dashboard is what is the schedule for today or this week right ? a list like that. There would be other views or options around that takes them to a specific semester and a specific course where they can edit the details and content of files and whatnot and the generated notes for those courses would be the core study material for lessons in the schedule. Hold on, about the exams, should the user be able to create the exam after going inside each course card i mean should they be creating exams for each course or there should be a general create exam button for a semester that they can use and whatever forms they have to fill in they will choose what course falls in which date... i am not super clear about that. You think on it and suggest me a crystal way for this pipeline. This part is important right ? because the entire schedule dating would be focused around when are the exams. Now the list in the dashboard, that would be kind of interactive, by that i mean when the user clicks a lesson it should take them to a place where they can view the notes in the right side window ( which will be an infinite canvas in the future, coming up in upcoming builds please keep this in mind it will be like miro infinite canvas where the same pdf thumbnail first and click pdf to make it scrollable will work, but with a lot of extra features such as drawing on the canvas moving around typing all that etc.... THIS is not for now JUST to keep in MIND). Now i'm wondering what would be a better UX solution here, maybe showing some details on the left side regarding that lesson, but keeping it minimal, and the right side window will show the pdf ( you know the thumbnail first and when clicked the pdf is scrollable). Here for the users convenience the right side window should be a bit more spacy and bigger than the left pane. The left pane lesson details should also have a way to take to the root info like the main course page of that course where the content are / deletable / manageable you know maybe just the page where content can be added and deleted. I wonder what UX solution would be best for, lets say we go into a specific course and then should the lessons for that course for each exam upcoming show up sequentially, like a lesson list for only that course. I am giving you freedom to think all these user usage-flows through and figure out and suggest the correct UX solutions for these problems now that you have an understanding of what the app is supposed to do. So feel free to suggest and ask stuff. 
Also, the calculation of schedule also has to take into account the lessons of multiple courses... The finish line for this particular build would be maybe the user adds multiple courses, add study materials and exams and a beautiful schedule is crafted for the user and showed on the dashboard along with the aspect of showing only the lessons and dates of those lessons for one particular course if the user goes into one particular courses' details. The representation and flow of the users usage for this product must reflect beautifully in the frontend.. the frontend should be inviting and basically automatically intrinsically guiding the user throughout and not be confusing at all. later on i will have frontend only build to make it more smooth and beautiful and stylish ( so make sure  to keep this in mind that the frontend will be worked on in the future i dont want things to break just cause we work with the frontend ) but for now the frontend should be user friendly and smooth and pretty. 




THIRD BUILD:

Now we are going to be creating the entire pipeline for quizzing after each lesson. For now, each lesson will have a quiz based on the content of that lesson. The quiz questions will be crafted by AI API. It will have both MCQ + enter your answer type questions (for now). I am not sure when would be the best time to generate the quiz questions. Maybe during notes generation ? you figure that out. Then we need to integrate that quiz in an interactive manner in the application... so when a user clicks Start Quiz or something like that the quiz part is started.. in there each question comes up one by one, window by window (like in NotebookLM), with options for MCQs. One important thing is the rendering of the questions and quiz texts.. for example if it's scientific question the software should be able to render subscripts and all scientific notations so keep that in mind. The amount of questions and marks should depend on the topic of the lesson and the question should be of two types.. first one is the concept testing questions that might not be similar to the questions of the previous exams, these questions test the foundational understanding and basic knowledge (doesnt mean the questions will be easy). And then comes the next type which is similar to the previous year questions (either full question or broken down into parts). The software has to fetch these questions from the API and then render them properly and show them into an interactive quiz mode. After selecting the correct answer the student will get score and if they select wrong there will be red color signal and it will say wrong and show the correct answer... you know the drill. Also in this build add a settings tab, a settings icon with which we can go to the settings tab, this tab will contain more stuff in the future but for now this will only contain one thing , specifically for testing, this will contain an option so i can change the gemini api to 3 different models. Again this is not for normal users but for me only. Make the interactive quiz UI very smooth and elegant and user friendly. Make sure after completing the quiz with all proper answers the lesson is automatically marked as done. Also add an option so that the users can mark a certain lesson Completed or done in the lesson card or something. You are free to us your own creativity to make this entire experience as engaging and fun and smooth as possible for the users.