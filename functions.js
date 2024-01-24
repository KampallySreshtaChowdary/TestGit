const fs = require('fs')
const nodemailer = require("nodemailer")
const path = require('path')
const pug = require('pug')
const _db = require('./db')
const logger = require('./logger')
const config = require('./config')
const formidable = require('formidable')
const timeSlots = require('./timeSlots')

// test comment

// This is the email transporter
const transporter = nodemailer.createTransport({
    host: "smtp.asu.edu",
    port: 587,
    secure: false,
    auth: {
        user: config.smtpUserName,
        pass: config.smtpPassword
    },
    tls: {
        ciphers: 'SSLv3'
    }
})

//New Application
const saveApplicationPdf = (req, res) => {
    let form = new formidable.IncomingForm()
    const db = _db.getDb()
    const collection = db.collection('applications')
    form.parse(req, (err, fields, files) => {
        collection.find({
            asuID: fields.asuID
        }).toArray().then(results => {
            if (true || results.length == 0) {
                saveApplicationFile(files['application-pdf'], `${fields.asuID}.application.pdf`)
                
                logger.info(`${fields.asuID}.application.pdf`)
                logger.info(files['application-pdf'])
                logger.info(fields)
                res.send('success')
                
            } else {
                res.render('applicant-thankyou', {
                    title: 'Thank you',
                    message: 'You cannot submit this application form this time as you have either already applied or your application was rejected'
                })
            }
        })

    })
}

const saveApplicationFile = (file, name) => {
    fs.readFile(file.path, (err, data) => {
        fs.writeFile(path.join(__dirname, '../uploads/applications', name), data, err => {
            if (err) logger.error(err)
            else logger.info('File uploaded successfully')
        })
    })
}

const saveApplicantToDb = applicant => {
    const db = _db.getDb()
    const collection = db.collection('applications')

    collection.insertOne(applicant, (err, result) => {
        if (err) logger.error(err)
        else logger.info(`Inserted ${applicant} to db.`)
    })
}

const saveApplication = (req, res) => {
    let form = new formidable.IncomingForm()
    let applicant = {}
    const db = _db.getDb()
    const collection = db.collection('applications')

    form.parse(req, (err, fields, files) => {
        applicant.firstName = fields.firstName
        applicant.middleName = fields.middleName
        applicant.lastName = fields.lastName
        applicant.asuEmail = fields.asuEmail
        applicant.asuID = fields.asuID
        applicant.semester = getSemester()
        applicant.status = "Applied"
        applicant.specialNotes = ""
        applicant.specialCourse = ""
        applicant.appliedDate = getDate()
        applicant.lastModified = getDate()
        applicant.emailedDate = ""
        applicant.interviewed = false
        applicant.deleted = false
        applicant.previous_status = ""

        collection.find({
            asuID: fields.asuID,
        }).sort({ semester: -1 }).toArray().then(results => {
            if (results.length > 0) {
                const mostRecentApplication = results[0];
                applicant.previous_status = mostRecentApplication.semester + " : " + mostRecentApplication.status;
            }
        });


        collection.find({
            asuID: fields.asuID,
            semester: getSemester()
        }).toArray().then(results => {
            if (results.length == 0) {
                // saveApplicationFile(files.applicationFile, `${fields.asuID}.application.pdf`)
                saveApplicationFile(files.transcriptFile, `${fields.asuID}.transcript.pdf`)
                // saveApplicationFile(files.hourFile, `${fields.asuID}.hours.pdf`)
                saveApplicantToDb(applicant)

                res.render('applicant-thankyou', {
                    title: 'Thank you',
                    message: 'Thank you for submitting the application.'
                })
            } else {
                // application exists as 'rejected' or as a previously entered application
                res.render('applicant-thankyou', {
                    title: 'Thank you',
                    message: 'You cannot submit this application this time as you have either already applied or your application was rejected'
                })
            }
        })

    })
}

const saveHoursAvailable = (file, name) => {
    fs.readFile(file.path, (err, data) => {
        fs.writeFile(path.join(__dirname, '../uploads/updatedHoursAvailable', name), data, err => {
            if (err) logger.error(err)
            else logger.info('File uploaded successfully')
        })
    })
}

const saveUpdatedTranscript = (file, name) => {
    let asuID = name
    name = name+'.transcript.pdf'
    fs.readFile(file.path, (err, data) => {
        fs.writeFile(path.join(__dirname, '../uploads/updatedTranscripts', name), data, err => {
            if (err) logger.error(err)
            else logger.info('File uploaded successfully')
        })
    })
    const db = _db.getDb();
    const sourceCollection = "applications";
    const targetCollection = "updatedTranscripts";
    db.collection(sourceCollection).findOne({ asuID: asuID }, (err, applicationData) => {
        if (err) {
            console.error("Error querying the 'applications' database:", err);
            return;
        }

        if (!applicationData) {
            console.error("No application found for the provided asuID:", asuID);
            return;
        }

        // Create a document for the "updatedTranscripts" database
        const updatedTranscriptDocument = {
            asuID: applicationData.asuID,
            firstName: applicationData.firstName,
            middleName: applicationData.middleName,
            lastName: applicationData.lastName,
            asuEmail: applicationData.asuEmail,
            semester: applicationData.semester,
            status: applicationData.status,
            lastModified: getDate()
            // You can add other fields as needed
        };
        db.collection(targetCollection).insertOne(updatedTranscriptDocument, (err, result) => {
            if (err) {
                console.error("Error inserting data into the 'updatedTranscripts' database:", err);
                return;
            }

            console.log("Document inserted successfully into 'updatedTranscripts' database");
        });
    });

}

const saveUpdatedHoursAvailable = (file, name) => {
    fs.readFile(file.path, (err, data) => {
        fs.writeFile(path.join(__dirname, '../uploads/hoursAvailable', name), data, err => {
            if (err) logger.error(err)
            else logger.info('File uploaded successfully')
        })
    })
}

const getSemester = date => {
    let d = date ? new Date(date) : new Date()
    let year = d.getFullYear()

    if (d.getMonth() > 7) {
        if (d.getDate() > 15 || d.getMonth() > 8) 
            return `Spring ${year + 1}`
        else
            return `Fall ${year}`
    } else if (d.getMonth() < 2) {
        if (d.getDate() < 15)
            return `Spring ${year}`
        else
            return `Fall ${year}`
    } else
        return `Fall ${year}`
}

const calculateSemester = date => {
    let d = date ? new Date(date) : new Date()
    let year = d.getFullYear()

    if (d.getMonth() > 7) {
        if (d.getDate() > 15 || d.getMonth() > 8) 
            return `Spring ${year + 1}`
        else
            return `Fall ${year}`
    } else if (d.getMonth() < 2) {
        if (d.getDate() < 15)
            return `Spring ${year}`
        else
            return `Fall ${year}`
    } else
        return `Fall ${year}`
}
        
// const getSemester = date => {
//     let d = date ? new Date(date) : new Date()
//     let year = d.getFullYear()

//     if (d.getMonth() > 7) {
//         if (d.getDate() > 15) 
//             return `Spring ${year + 1}`
//         else
//             return `Fall ${year}`
//     } else if (d.getMonth() === 2) {
//         if (d.getDate() < 15)
//             return `Spring ${year + 1}`
//         else
//             return `Fall ${year}`
//     } else
//         return `Fall ${year}`
// }

const getDate = () => new Date()

const getFormattedDate = date => {
    let d = date ? new Date(date) : new Date()
    return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}`
}

const getEmail = asuID => {
    const db = _db.getDb()

    return db.collection('applications').findOne({
        asuID: asuID
    }).then(e => e.asuEmail)
}

const getSemestersList = () => {
    const db = _db.getDb()

    return db.collection('applications').find().toArray()
        .then(e => e.map(e => e.semester))
        .then(e => [...new Set(e)])
}

const renderAdmin = (req, res) => {
    console.log('renderAdmin', req)
    let status = req.status
    //let semester = req.semester ? req.semester : getSemester()
    // Default filter
    let filter = {
        // status: {
        //     $regex: new RegExp('applied*|^other*', "i")
        // },
        //semester: semester
        status: 'Applied'
    }

    switch (status) {
        case 'search-query':
            renderSearchResults(req, res)
            break
        case 'Would Hire':
            filter = {
                status: 'Would Hire',
                //semester: semester
            }
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: filter.status,
                        status: filter.status,
                        applications: applications
                    })
                })
            })
            break
        case 'Hired':
            filter = {
                status: 'Hired',
                //semester: semester
            }
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: filter.status,
                        status: filter.status,
                        applications: applications
                    })
                })
            })
            break
        case 'Rejected':
            let status = 'Reject'
            filter = {
                status: {
                    $regex: new RegExp('^reject*', "i")
                },
                //semester: semester
            }
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: status,
                        status: status,
                        applications: applications
                    })
                })
            })
            break
        case 'Under Review':
            filter = {
                status: 'Under Review',
                //semester: semester
            }
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: filter.status,
                        status: filter.status,
                        applications: applications
                    })
                })
            })
            break
        case 'Would Schedule':
            filter = {
                status: {
                    $regex: new RegExp('Would Schedule|Emailed', "i")
                },
               // semester: semester
            }
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: 'Would Schedule',
                        status: 'Would Schedule',
                        applications: applications
                    })
                })
            })
            break
        case 'Others':
            filter = {
                
                //status: 'Other - ',
               // semester: semester
               status: {
                $regex: new RegExp('^Other*|Former*', "i")
                //$regex: new RegExp('applied*|^other*', "i")
               }
            }

            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        // caption: 'filter.status',
                        status: filter.status,
                        caption: 'Others',
                        applications: applications
                    })
                })
            })
            break
        default:
            getApplications(filter).then(applications => {
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: 'Home',
                        status: 'Applied',
                        applications: applications
                    })
                })
            })
    }

}

const renderSearchResults = (req, res) => {
    let query = req.query
    //let semester = req.semester ? req.semester : getSemester()

    console.log('search query ' + JSON.stringify(req))

    let type = /^\d+$/.test(query) ? "asuID" : "lastName"
    let filter = {}

    switch (type) {
        case "asuID":
            filter = {
                asuID: query
                //,semester: semester
            }
            console.log(filter)
            getApplicationsSearch(filter).then(applications => {
                console.log(applications)
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin',
                        //semester: semester,
                        semesters: list,
                        caption: "Search results",
                        status: filter.semester,
                        searchQuery: query,
                        applications: applications
                    })
                })
            })
            break
        case "lastName":
            filter = {
                lastName: query
                //,semester: semester
            }
            console.log(filter)
            getApplicationsSearch(filter).then(applications => {
                console.log(applications)
                getSemestersList().then(list => {
                    res.render('admin', {
                        title: 'GIA Admin | Search Results',
                        //semester: semester,
                        semesters: list,
                        caption: "Search results",
                        status: filter.semester,
                        searchQuery: query,
                        applications: applications
                    })
                })
            })
            break
    }
}

const getApplications = filter => {
    const db = _db.getDb()

    return db.collection('applications').find({
        status: filter.status,
        //semester: filter.semester
    }).toArray()
}

const getApplicationsSearch = filter => {
    const db = _db.getDb()
    if (filter.asuID)
        return db.collection('applications').find({
            asuID: filter.asuID,
            deleted: false
        }).toArray()
    else return db.collection('applications').find({
        lastName: {
            $regex: new RegExp(filter.lastName, "i")
        },
        deleted: false
    }).toArray()
}

const verify = (req, res, next) => {
    if (req.user)
        if (req.user.role === 'admin')
            next()
        else res.redirect('/gia/logout')
    else res.redirect('/gia/login')
}

const verifyHR = (req, res, next) => {
    if (req.user)
        if (req.user.role === 'hr')
            next()
        else res.redirect('/gia/logout')
    else res.redirect('/gia/login')
}

const verifyEmployee = (req, res, next) => {
    if (req.user)
        if (req.user.role === 'employee')
            next()
        else res.redirect('/gia/logout')
    else res.redirect('/gia/login')
}

const getApplicantDetails = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID

    db.collection('applications').findOne({
        asuID: asuID,
        semester: semester
    }).then(details => {
        res.render('details', {
            title: 'Applicant details',
            details: details
        })
    })
}

const updateApplicantDetails = (req, res) => {
    const db = _db.getDb()

    db.collection('applications').updateOne({
        asuID: req.body.asuID,
        semester: req.body.semester
    }, {
        $set: {
            specialNotes: req.body.specialNotes,
            status: req.body.status,
            specialCourse: req.body.specialCourse,
            lastModified: getDate()
        }
    }).then(e => {
        console.log(e.result)
        if (e.result.ok === 1) {
            console.log('success')
            res.send('success')
        } else {
            console.log('failed')
            res.send('Failed')
        }
    }).catch(err => {
        console.log(err)
        res.send('Error')
    })
}

const deleteApplication = (req, res) => {
    const db = _db.getDb()

    db.collection('applications').deleteOne({
        asuID: req.body.asuID,
        semester: req.body.semester
    }).then(e => {
        if (e.result.ok === 1) {
            console.log('successfully deleted')
            res.send('success')
        } else {
            console.log('failed')
            res.send('Failed')
        }
    }).catch(err => {
        console.log(err)
        res.send('Error')
    })
}

const renderInterviews = (req, res) => {

    Promise.all([
        getApplicantBasicDetails(req.params.asuID, req.params.semester),
        getInterviewQuestions(req.params.set),
        getInterviewAnswers(req.params.asuID, getSemester(), req.params.set),
        getInterviewSummary(req.params.asuID, getSemester(), req.params.set)
    ]).then(e => {
        let details = e[0]
        let questions = e[1]
        let answers = e[2]
        let summary = e[3]

        res.render('interview', {
            applicantInfo: details,
            semester: req.params.semester,
            set: req.params.set,
            questions: questions,
            answers: answers,
            summary: summary
        })
    })
}

// Get basic details given asuID and semester
const getApplicantBasicDetails = (asuID, semester) => {
    const db = _db.getDb()

    return db.collection('applications').find({
        asuID: asuID,
        //semester: semester,
        deleted: false
    }).sort({_id:-1}).toArray().then(details => {
        return {
            firstName: details[0].firstName,
            middleName: details[0].middleName,
            lastName: details[0].lastName,
            asuID: details[0].asuID,
            appliedDate: getFormattedDate(details[0].appliedDate),
            asuEmail: details[0].asuEmail
        }
    })
}

// Get basic details given emailID
const getApplicantBasicDetailsForEmail = asuEmail => {
    const db = _db.getDb()

    return db.collection('applications').findOne({
        asuEmail: asuEmail,
        deleted: false
    }).then(details => {
        return {
            firstName: details.firstName,
            lastName: details.lastName,
            asuID: details.asuID,
            appliedDate: getFormattedDate(details.appliedDate),
            asuEmail: details.asuEmail,
            semester: details.semester
        }
    })
}

const sendEmail = (req, res) => {
    const db = _db.getDb()
    let type = req.body.type
    let html_mail = ''

    getApplicantBasicDetailsForEmail(req.body.emailID).then(details => {

        switch (type) {
            case 'interview-invite':
                const compiledFunction_ii = pug.compileFile('./views/interview_schedule_email_old.pug')
                html_mail = compiledFunction_ii({
                    firstName: details.firstName,
                    lastName: details.lastName,
                    date: getFormattedDate().split(' ')[0]
                })
                transporter.sendMail({
                    from: {
                        name: 'do-not-reply',
                        address: 'gia.math@asu.edu'
                    },
                    to: {
                        name: `${details.firstName} ${details.lastName}`,
                        address: req.body.emailID
                    },
                    cc: 'gia.math@asu.edu',
                    bcc: ['joseph.w.davis@asu.edu','qrobins6@asu.edu'],
            
		    priority: 'high',
                    subject: 'Call to Interview with SoMSS',
                    html: html_mail
                }, (err, info) => {
	           console.log(err)
	           console.log('######################')
                   console.log(info)
                   console.log(info.envelope)
                   console.log(info.messageId)
                    db.collection('applications').updateOne({
                        asuID: details.asuID,
                        semester: details.semester
                    }, {
                        $set: {
                            status: "Emailed",
                            lastModified: getDate(),
                            emailedDate: getFormattedDate(),
                            scheduled: 1
                        },
                        $inc: {
                            inviteCount: 1
                        }
                    })
                    if (!err) res.send('success')
                    else res.send('Something went wrong')
                })
                break
            case 'application-empty':
                const compiledFunction_ae = pug.compileFile('./views/application-empty-email.pug')
                html_mail = compiledFunction_ae({
                    firstName: details.firstName,
                    lastName: details.lastName,
                    date: getFormattedDate().split(' ')[0]
                })
                transporter.sendMail({
                    from: {
                        name: 'do-not-reply',
                        address: 'gia.math@asu.edu'
                    },
                    to: {
                        name: `${details.firstName} ${details.lastName}`,
                        address: req.body.emailID
                    },
                    cc: 'gia.math@asu.edu',
                    priority: 'high',
                    subject: 'Application files empty, Grader/IA Coordinator SoMSS',
                    html: html_mail
                }, (err, info) => {
                   console.log(info.envelope)
                   console.log(info.messageId)
                    db.collection('applications').deleteOne({
                        asuID: details.asuID,
                        semester: details.semester
                    }).then(e => {
                        if (!err && e.result.ok === 1) res.send('success')
                        else res.send('Something went wrong')
                    })
                })
        }
    })
}

const getInterviewQuestions = set => {
    const db = _db.getDb()

    return db.collection('questions').find({
        set: set
    }).toArray().then(e => e)
}

const getInterviewAnswers = (asuID, semester, set) => {
    const db = _db.getDb()
    var numberOfQuestions
    if(set === '1')
    {
        numberOfQuestions=14
    }
    else 
    {
        numberOfQuestions=17
    }
    const totalInterviewQuestions=numberOfQuestions
    return db.collection('answers').find({
        asuID: asuID,
        //semester: semester,
        set: set
    }).sort({_id:-1}).limit(totalInterviewQuestions).toArray().then(e => {
        return e.map(x => {
            return {
                id: x.id,
                answer: x.answer
            }
        })
    })
}

const getInterviewSummary = (asuID, semester, set) => {
    const db = _db.getDb()

    return db.collection('summaries').find({
        asuID: asuID,
        //semester: semester,
        set: set
    }).toArray().then(e => {
        if (e.length < 1)
            return e
        else
            return e[e.length-1]
    })
}

const saveInterviews = (req, res) => {
    const db = _db.getDb()
    let set = req.body.set
    let asuID = req.body.asuID
    let semester = getSemester()
    let dateapplied = req.body.dateapplied
    let semesterapplied = calculateSemester(dateapplied)

    req.body.answers.map(answer => {
        db.collection('answers').updateOne({
                asuID: asuID,
                set: set,
                semester: semester,
                id: answer.id
            }, {
                $set: {
                    answer: answer.answer
                }
            }, {
                upsert: true
            })
            .then(result => {})
            .catch(err => logger.error(JSON.stringify(err)))
    })

    db.collection('summaries').insertOne({
        asuID: asuID,
        semester: semester,
        set: set,
        summary: req.body.summary,
        date: getFormattedDate()
    })
    .then(result => {})
    .catch(err => logger.error(`Error while inserting summaries ${JSON.stringify(err)}`))

    getApplicantBasicDetails(asuID, semesterapplied)
        .then(details => {
            const compiledFunction = pug.compileFile('./views/send_summary.pug')
            let html_mail = compiledFunction({
                firstName: details.firstName,
                lastName: details.lastName,
                date: getFormattedDate().split(' ')[0],
                summary: req.body.summary,
                asuID: details.asuID
            })
            transporter.sendMail({
                from: {
                    name: 'Grader/IA Coordinator',
                    address: 'gia.math@asu.edu'
                },
                to: config.managerEmail,
                priority: 'high',
                subject: `Interview summary for ${details.firstName} ${details.lastName}`,
                html: html_mail
            }, (err, info) => {
                console.log(info.envelope)
                console.log(info.messageId)
            })
        })
        .then(() => {
            return db.collection('applications').updateOne({
                asuID: asuID,
                semester: semesterapplied
            }, {
                $set: {
                    interviewed: `Interview ${set}`,
                    lastModified: getDate()
                }
            })
        })

    res.send('success')
}

const renderHR = (req, res) => {

    getApplicationsForHR().then(applications => {

        res.render('hr', {
            applications: applications.map(x => {
                return {
                    firstName: x.firstName,
                    lastName: x.lastName,
                    lastModified: x.lastModified,
                    status: x.status,
                    semester: x.semester,
                    asuID: x.asuID,
                    specialNotes: x.specialNotes
                }
            })
        })
    })
}

const renderHRSearch = (req, res) => {

    console.log('rendersearch', req.body)

    let filter = {
        query: req.body.query
    }

    getApplicationsForHR(filter).then(applications => {

        res.render('hr', {
            applications: applications.map(x => {
                return {
                    firstName: x.firstName,
                    middleName: x.middleName,
                    lastName: x.lastName,
                    lastModified: x.lastModified,
                    status: x.status,
                    semester: x.semester,
                    asuID: x.asuID
                }
            }),
            title: 'GIA HR | Search',
            searchQuery: filter.query
        })
    })
}

const getApplicationsForHR = filter => {
    const db = _db.getDb()

    if (!filter) {
        return db.collection('applications').find({
            deleted: false
        }).toArray()
    } else {
        return db.collection('applications').find({
            $or: [{
                firstName: {
                    $regex: new RegExp(filter.query, "i")
                }
            }, {
                lastName: {
                    $regex: new RegExp(filter.query, "i")
                }
            }, {
                asuID: {
                    $regex: new RegExp(filter.query, "i")
                }
            }],
            deleted: false
        }).toArray()
    }
}

const renderInterviewSummariesHR = (req, res) => {
    Promise.all([
        getInterviewSummary(req.params.asuID, req.params.semester, '1'),
        getInterviewSummary(req.params.asuID, req.params.semester, '2')
    ]).then(interviewSummaries => {
        console.log(interviewSummaries)
        res.render('hr-summary', {
            interview1: interviewSummaries[0],
            interview2: interviewSummaries[1],
            asuID: req.params.asuID
        })
    })
}

const saveUpdatedHoursFormFallSpring = (req, res) => {
    const db = _db.getDb()
    let asuID = req.body.asuID
    let details = req.body.details
    console.log(req.body.flag)
    let _collection = req.body.flag == "employee" ? "updatedHoursAvailable" : "hoursAvailable"
    console.log(_collection)
    db.collection(_collection).updateOne({
            asuID: asuID
        }, {
            $set: {
                asuriteID: details.asuriteID,
                firstName: details.firstName,
                lastName: details.lastName,
                asuEmail: details.asuEmail,
                iaHours: details.iaHours,
                graderHours: details.graderHours,
                semester: details.applicableSemester,
                year: details.year,
                startDate: details.startDate,
                specialNotes: details.specialNotes,
                mwfComments: req.body.mwfEntries,
                mwComments: req.body.mwEntries,
                tthComments: req.body.tthEntries,
                lastModified: getDate()
            }
        }, {
            upsert: true
        }).then(e => {
            console.log(e.result)
            if (e.result.ok === 1) {
                console.log('success')
                res.send('success')
            } else {
                console.log('failed')
                res.send('Failed')
            }
        }).catch(err => {
            console.log(err)
            res.send('Error')
        })
}

const saveUpdatedHoursFormSummer = (req, res) => {
    const db = _db.getDb()
    let asuID = req.body.asuID
    let details = req.body.details
   let semester = details.applicableSemester
   console.log(semester)
    let _collection = req.body.flag == "employee" ? "updatedHoursAvailableSummer" : "hoursAvailableSummer"


   db.collection(_collection).updateOne({
            asuID: asuID, 
            semester: semester
        }, {
            $set: {
                asuriteID: details.asuriteID,
                firstName: details.firstName,
                lastName: details.lastName,
                asuEmail: details.asuEmail,
                iaHours: details.iaHours,
                graderHours: details.graderHours,
                semester: details.applicableSemester,
                year: details.year,
                startDate: details.startDate,
                specialNotes: details.specialNotes,
                // summerComments: req.body.summerEntries,
                sumAorBComments: req.body.sumAorBEntries,
                sumCComments: req.body.sumCEntries,
                lastModified: getDate()
            }
        }, {
            upsert: true
        }).then(e => {
            console.log(e.result)
            if (e.result.ok === 1) {
                console.log('successfully updated hour details.')
                res.send('success')
            } else {
                console.log('failed')
                res.send('Failed')
            }
        }).catch(err => {
            console.log(err)
            res.send('Error')
        })

}


const getApplicanthoursAvailable = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID
    //TODO: confirm with Satya
    // updatedHoursAvailable or hoursAvailable
    let upHoursColl = "updatedHoursAvailable"
    let hoursColl = "hoursAvailable"
    let upHoursCollSummer = "updatedHoursAvailableSummer"
    let hoursCollSummer = "hoursAvailableSummer"
    db.collection(upHoursColl).find({asuID: asuID}).toArray().then(detailsNew => {
    db.collection(hoursColl).find({asuID: asuID}).toArray().then(detailsOld => {
	    var details = detailsNew;
        if (detailsNew.length < 1) {
            details = detailsOld;
        }
        var detailsSummer;
        db.collection(upHoursCollSummer).find({
            asuID: asuID,
        }).toArray().then(detailsSummerOld => {
            db.collection(hoursCollSummer).find({
                asuID: asuID,
                // semester: semester
            }).toArray().then(detailsSummerNew => {
                detailsSummer = detailsSummerNew;
                if (detailsSummerNew.length < 1) {
                    detailsSummer = detailsSummerOld;
                }
                if (details.length < 1 && detailsSummer.length < 1) {
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: null
                    })
                }
                else {
                    var mwSlotsDetails = {};
                    var mwfSlotsDetails = {};
                    var tthSlotsDetails = {};
                    //var summerSlotsDetails = {};
                    var sumAorBSlotsDetails = {};
                    var sumCSlotsDetails = {};
                    let summerDays = timeSlots.summer.schedule;
                    if(details && details.length > 0) {
        
                        details = details[0]
                        let mwfSlots = timeSlots.fall_spring.mwfSlots;
                        
                        mwfSlots.forEach((key, i) => mwfSlotsDetails[key] = details['mwfComments'][i]);
        
        
                        let mwSlots = timeSlots.fall_spring.mwSlots;
                        
                        mwSlots.forEach((key, i) => mwSlotsDetails[key] = details['mwComments'][i]);
        
        
                        let tthSlots = timeSlots.fall_spring.tthSlots;
                        
                        tthSlots.forEach((key, i) => tthSlotsDetails[key] = details['tthComments'][i]);

                        if (typeof(details['iaHours']) == 'undefined'){
                            details['iaHours'] = "MISSING FROM DB";
                        }
                    }else{
                        details = null
                    }
                    if(detailsSummer && detailsSummer.length > 0) {
                        detailsSummer = detailsSummer[0]
                        
                        //let summerSlots = timeSlots.summer.slots;
                        let sumAorBSlots = timeSlots.summer.sumAorBSlots;
                        let sumCSlots = timeSlots.summer.sumCSlots;
                        
                        //summerSlots.forEach((key, i) => summerSlotsDetails[key] = detailsSummer['summerComments'][i]);

                        sumAorBSlots.forEach((key, i) => sumAorBSlotsDetails[key] = detailsSummer['sumAorBComments'][i]);
                        sumCSlots.forEach((key, i) => sumCSlotsDetails[key] = detailsSummer['sumCComments'][i]);

                    }else{
                        detailsSummer = null
                    }
                    //console.log(details)
                    //For Fall and Spring.
                    
                    // console.log(result);
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: details,
                        detailsSummer: detailsSummer,
                        schedule: timeSlots.fall_spring.schedule,
                        mwfSlotsDetails: mwfSlotsDetails,
                        mwSlotsDetails: mwSlotsDetails,
                        tthSlotsDetails: tthSlotsDetails,
                        summerDays:  summerDays,
                        //summerSlotsDetails: summerSlotsDetails
                        sumAorBSlotsDetails: sumAorBSlotsDetails,
                        sumCSlotsDetails: sumCSlotsDetails
                    })
                }
            })
        })
    })
    });
}



const getAllApplicanthours = (req, res) => {
    const db = _db.getDb()
    db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray().then(updatedHoursAvailable => {
        db.collection('hoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
            let applications = updatedHoursAvailable.concat(hoursAvailable);

            res.render('allUpdatedApplicants', {
                title: 'updatedHoursAvailable',
                appsCount: applications.length,
                updatedHours: applications})
        })
    });
    // getUpdatedHoursAvailable({}).then(applications => {
    // res.render('allUpdatedApplicants', {
    //     title: 'updatedHoursAvailable',
    //     appsCount: applications.length,
    //     updatedHours: applications})
    // })
}

//Employee only hours for Fall/Spring, from hoursAvailable collection
const getEmployeeHours = (req, res) => {
    const db = _db.getDb()
    db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray().then(updatedHoursAvailable => {
    // db.collection('hoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
        let applications = updatedHoursAvailable;

        res.render('employeeAllUpdatedApplicants', {
            title: 'Employee Hours',
            appsCount: applications.length,
            updatedHours: applications})
    });
}

//Employee only hours for Summer, from hoursAvailableSummer collection
const getEmployeeHoursSummer = (req, res) => {
    const db = _db.getDb()
    //db.collection('hoursAvailableSummer').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
    db.collection('updatedHoursAvailableSummer').find().sort({lastModified: -1}).toArray().then(updatedHoursAvailable => {
        let applications = updatedHoursAvailable;

        res.render('employeeAllUpdatedApplicantsSummer', {
            title: 'Employee Hours Summer',
            appsCount: applications.length,
            updatedHours: applications})
    });
}

//Applicant only hours for Fall/Spring, from updatedHoursAvailable collection
const getApplicantHours = (req, res) => {
    const db = _db.getDb()
    db.collection('hoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
    //db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
        let applications = hoursAvailable;

        res.render('applicantAllUpdatedApplicants', {
            title: 'Applicant Hours',
            appsCount: applications.length,
            updatedHours: applications})
    });
}

//Applicant only hours for Summer, from updatedHoursAvailableSummer collection
const getApplicantHoursSummer = (req, res) => {
    const db = _db.getDb()
    db.collection('hoursAvailableSummer').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
    //db.collection('updatedHoursAvailableSummer').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
        let applications = hoursAvailable;

        res.render('applicantAllUpdatedApplicantsSummer', {
            title: 'Applicant Hours Summer',
            appsCount: applications.length,
            updatedHours: applications})
    });
}

const getUpdatedHoursAvailable = filter => {
    const db = _db.getDb()
    console.log("Step 0 ")
    // db.collection('updatedHoursAvailable').distinct("asuID",{}, function(err, docs) {
    //     return db.collection('updatedHoursAvailable').find({"asuID": { "$in":docs}}).toArray();
    //     // var asuIDs = docs;
    //     // console.log(docs)
    // })
    //const res = []
    //const res = db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray()
    //res.push(db.collection('hoursAvailable').find().sort({lastModified: -1}).toArray())
    return db
}

const getEmployeeDetailHours = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID
    //TODO: confirm with Satya
    // updatedHoursAvailable or hoursAvailable
    let upHoursColl = "updatedHoursAvailable"
    let hoursColl = "hoursAvailable"
    let upHoursCollSummer = "updatedHoursAvailableSummer"
    let hoursCollSummer = "hoursAvailableSummer"
    db.collection(upHoursColl).find({asuID: asuID}).toArray().then(detailsNew => {
    db.collection(hoursColl).find({asuID: asuID}).toArray().then(detailsOld => {
	    var details = detailsNew;
        if (detailsNew.length < 1) {
            details = detailsOld;
        }
        var detailsSummer;
        db.collection(upHoursCollSummer).find({
            asuID: asuID,
        }).toArray().then(detailsSummerOld => {
            db.collection(hoursCollSummer).find({
                asuID: asuID
               //semester: semester
            }).toArray().then(detailsSummerNew => {
                detailsSummer = detailsSummerNew;
                if (detailsSummerNew.length < 1) {
                    detailsSummer = detailsSummerOld;
                }
                if (details.length < 1 && detailsSummer.length < 1) {
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: null
                    })
                }
                else {
                    var mwSlotsDetails = {};
                    var mwfSlotsDetails = {};
                    var tthSlotsDetails = {};
                    if(details && details.length > 0) {
        
                        details = details[0]
                        let mwfSlots = timeSlots.fall_spring.mwfSlots;
                        
                        mwfSlots.forEach((key, i) => mwfSlotsDetails[key] = details['mwfComments'][i]);
        
        
                        let mwSlots = timeSlots.fall_spring.mwSlots;
                        
                        mwSlots.forEach((key, i) => mwSlotsDetails[key] = details['mwComments'][i]);
        
        
                        let tthSlots = timeSlots.fall_spring.tthSlots;
                        
                        tthSlots.forEach((key, i) => tthSlotsDetails[key] = details['tthComments'][i]);

                        if (typeof(details['iaHours']) == 'undefined'){
                            details['iaHours'] = "MISSING FROM DB";
                        }
                    }else{
                        details = null
                    }

                    detailsSummer = null
                    //console.log(details)
                    //For Fall and Spring.
                    
                    // console.log(result);
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: details,
                        detailsSummer: detailsSummer,
                        schedule: timeSlots.fall_spring.schedule,
                        mwfSlotsDetails: mwfSlotsDetails,
                        mwSlotsDetails: mwSlotsDetails,
                        tthSlotsDetails: tthSlotsDetails
                    })
                }
            })
        })
    })
    });
}

const getEmployeeDetailHoursSummer = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID
    //TODO: confirm with Satya
    // updatedHoursAvailable or hoursAvailable
    let upHoursColl = "updatedHoursAvailable"
    let hoursColl = "hoursAvailable"
    let upHoursCollSummer = "updatedHoursAvailableSummer"
    let hoursCollSummer = "hoursAvailableSummer"
    db.collection(upHoursColl).find({asuID: asuID}).toArray().then(detailsNew => {
    db.collection(hoursColl).find({asuID: asuID}).toArray().then(detailsOld => {
	    var details = null
        var detailsSummer;
        db.collection(upHoursCollSummer).find({
            asuID: asuID,
        }).toArray().then(detailsSummerOld => {
            db.collection(hoursCollSummer).find({
                asuID: asuID,
                semester: semester
            }).toArray().then(detailsSummerNew => {
                detailsSummer = detailsSummerNew;
                if (detailsSummerNew.length < 1) {
                    detailsSummer = detailsSummerOld;
                }
                if (detailsSummer.length < 1) {
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: null
                    })
                }
                else {
                    var mwSlotsDetails = {};
                    var mwfSlotsDetails = {};
                    var tthSlotsDetails = {};
                    //var summerSlotsDetails = {};
                    var sumAorBSlotsDetails = {};
                    var sumCSlotsDetails = {};
                    let summerDays = timeSlots.summer.schedule;
        
                    if(detailsSummer && detailsSummer.length > 0) {
                        detailsSummer = detailsSummer[0]
                        
                        //let summerSlots = timeSlots.summer.slots;
                        let sumAorBSlots = timeSlots.summer.sumAorBSlots;
                        let sumCSlots = timeSlots.summer.sumCSlots;
                        
                        //summerSlots.forEach((key, i) => summerSlotsDetails[key] = detailsSummer['summerComments'][i]);

                        sumAorBSlots.forEach((key, i) => sumAorBSlotsDetails[key] = detailsSummer['sumAorBComments'][i]);
                        sumCSlots.forEach((key, i) => sumCSlotsDetails[key] = detailsSummer['sumCComments'][i]);

                    }else{
                        detailsSummer = null
                    }
                    //console.log(details)
                    //For Fall and Spring.
                    
                    // console.log(result);
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: details,
                        detailsSummer: detailsSummer,
                        schedule: timeSlots.fall_spring.schedule,
                        mwfSlotsDetails: mwfSlotsDetails,
                        mwSlotsDetails: mwSlotsDetails,
                        tthSlotsDetails: tthSlotsDetails,
                        summerDays:  summerDays,
                        sumAorBSlotsDetails: sumAorBSlotsDetails,
                        sumCSlotsDetails: sumCSlotsDetails
                    })
                }
            })
        })
    })
    });
}

const getApplicantDetailHours = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID
    //TODO: confirm with Satya
    // updatedHoursAvailable or hoursAvailable
    let upHoursColl = "updatedHoursAvailable"
    let hoursColl = "hoursAvailable"
    let upHoursCollSummer = "updatedHoursAvailableSummer"
    let hoursCollSummer = "hoursAvailableSummer"
    db.collection(upHoursColl).find({asuID: asuID}).toArray().then(detailsNew => {
    db.collection(hoursColl).find({asuID: asuID}).toArray().then(detailsOld => {
	    var details = detailsNew;
        if (detailsNew.length < 1) {
            details = detailsOld;
        }
        var detailsSummer;
        db.collection(upHoursCollSummer).find({
            asuID: asuID,
        }).toArray().then(detailsSummerOld => {
            db.collection(hoursCollSummer).find({
                asuID: asuID
               // semester: semester
            }).toArray().then(detailsSummerNew => {
                detailsSummer = detailsSummerNew;
                if (detailsSummerNew.length < 1) {
                    detailsSummer = detailsSummerOld;
                }
                if (details.length < 1 && detailsSummer.length < 1) {
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: null
                    })
                }
                else {
                    var mwSlotsDetails = {};
                    var mwfSlotsDetails = {};
                    var tthSlotsDetails = {};
                    //var summerSlotsDetails = {};
                    var sumAorBSlotsDetails = {};
                    var sumCSlotsDetails = {};
                    let summerDays = timeSlots.summer.schedule;
                    if(details && details.length > 0) {
        
                        details = details[0]
                        let mwfSlots = timeSlots.fall_spring.mwfSlots;
                        
                        mwfSlots.forEach((key, i) => mwfSlotsDetails[key] = details['mwfComments'][i]);
        
        
                        let mwSlots = timeSlots.fall_spring.mwSlots;
                        
                        mwSlots.forEach((key, i) => mwSlotsDetails[key] = details['mwComments'][i]);
        
        
                        let tthSlots = timeSlots.fall_spring.tthSlots;
                        
                        tthSlots.forEach((key, i) => tthSlotsDetails[key] = details['tthComments'][i]);

                        if (typeof(details['iaHours']) == 'undefined'){
                            details['iaHours'] = "MISSING FROM DB";
                        }
                    }else{
                        details = null
                    }
                    
                        detailsSummer = null
                    
                    //console.log(details)
                    //For Fall and Spring.
                    
                    // console.log(result);
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: details,
                        detailsSummer: detailsSummer,
                        schedule: timeSlots.fall_spring.schedule,
                        mwfSlotsDetails: mwfSlotsDetails,
                        mwSlotsDetails: mwSlotsDetails,
                        tthSlotsDetails: tthSlotsDetails,
                    })
                }
            })
        })
    })
    });
}


const getApplicantDetailHoursSummer = (req, res) => {
    const db = _db.getDb()
    let semester = req.params.semester
    let asuID = req.params.asuID
    //TODO: confirm with Satya
    // updatedHoursAvailable or hoursAvailable
    let upHoursColl = "updatedHoursAvailable"
    let hoursColl = "hoursAvailable"
    let upHoursCollSummer = "updatedHoursAvailableSummer"
    let hoursCollSummer = "hoursAvailableSummer"
    db.collection(upHoursColl).find({asuID: asuID}).toArray().then(detailsNew => {
    db.collection(hoursColl).find({asuID: asuID}).toArray().then(detailsOld => {
	    var details = null
        var detailsSummer;
        db.collection(upHoursCollSummer).find({
            asuID: asuID,
        }).toArray().then(detailsSummerOld => {
            db.collection(hoursCollSummer).find({
                asuID: asuID,
                semester: semester
            }).toArray().then(detailsSummerNew => {
                detailsSummer = detailsSummerNew;
                if (detailsSummerNew.length < 1) {
                    detailsSummer = detailsSummerOld;
                }
                if (detailsSummer.length < 1) {
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: null
                    })
                }
                else {
                    var mwSlotsDetails = {};
                    var mwfSlotsDetails = {};
                    var tthSlotsDetails = {};
                    //var summerSlotsDetails = {};
                    var sumAorBSlotsDetails = {};
                    var sumCSlotsDetails = {};
                    let summerDays = timeSlots.summer.schedule;
        
                    if(detailsSummer && detailsSummer.length > 0) {
                        detailsSummer = detailsSummer[0]
                        
                        //let summerSlots = timeSlots.summer.slots;
                        let sumAorBSlots = timeSlots.summer.sumAorBSlots;
                        let sumCSlots = timeSlots.summer.sumCSlots;
                        
                        //summerSlots.forEach((key, i) => summerSlotsDetails[key] = detailsSummer['summerComments'][i]);

                        sumAorBSlots.forEach((key, i) => sumAorBSlotsDetails[key] = detailsSummer['sumAorBComments'][i]);
                        sumCSlots.forEach((key, i) => sumCSlotsDetails[key] = detailsSummer['sumCComments'][i]);

                    }else{
                        detailsSummer = null
                    }
                    //console.log(details)
                    //For Fall and Spring.
                    
                    // console.log(result);
                    res.render('applicationInfo', {
                        title: 'Applicant details',
                        details: details,
                        detailsSummer: detailsSummer,
                        schedule: timeSlots.fall_spring.schedule,
                        mwfSlotsDetails: mwfSlotsDetails,
                        mwSlotsDetails: mwSlotsDetails,
                        tthSlotsDetails: tthSlotsDetails,
                        summerDays:  summerDays,
                        sumAorBSlotsDetails: sumAorBSlotsDetails,
                        sumCSlotsDetails: sumCSlotsDetails
                    })
                }
            })
        })
    })
    });
}

const getUpdatedTranscripts = (req, res) => {
    const db = _db.getDb()
    db.collection('updatedTranscripts').find().sort({lastModified: -1}).toArray().then(updatedTranscripts => {
    //db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
        let database = updatedTranscripts;

        res.render('updatedTranscripts', {
            title: 'Updated Transcripts',
            appsCount: database.length,
            updatedHours: database})
    });
}

const validInterview = (req, res) => {
    asuID= req.body.asuID
    const db = _db.getDb()
    db.collection('applications').findOne({
        'asuID': asuID,
        'semester': getSemester()
    }).then(e => {
        if(!e) {
            res.render('FailedLoginInterview', {
                title: 'Login Failed',
                message: 'There is no Application under this ASU ID'
            })
            return;
        }
        if (e.scheduled === 1) {
            db.collection('interviewSchedule').find().sort({lastModified: -1}).toArray().then(interviewSchedule => {
                let database = interviewSchedule;
                db.collection('instructorSlots').find().toArray().then(instructorSlots => {
                    let slotDb = instructorSlots
                    res.render('interviewSchedule', {
                        title: 'Interview Schedule Page',
                        asuID: asuID,
                        firstName: e.firstName,
                        lastName: e.lastName,
                        interviewSchedule: database,
                        instructorSlots: slotDb
                    })
                })
                
                    
            })
            return;
        }
        if (e.scheduled === 2) {
            res.render('FailedLoginInterview', {
                title: 'Login Failed',
                message: 'You have already scheduled or tried to schedule an appointment. '
            })
            return;
        }
        if (!e.scheduled) {
            res.render('FailedLoginInterview', {
                title: 'Login Failed',
                message: 'You cannot schedule the appointment. Please make sure you received the email from gia.math@asu.edu to schedule an appointment.'
            })
            return;
        }
    })
}

const saveInterviewSlot = (req, res) => {
    let form = new formidable.IncomingForm()
    let slot = {}
    const db = _db.getDb()
    const collection = db.collection('interviewSchedule')

    form.parse(req, (err, fields) => {
        slot.asuID = fields.asuID
        slot.firstName = fields.firstName
        slot.lastName = fields.lastName
        const timeRegex = /^(\w{3} \w{3} \d{2} \d{4}) - (\d{1,2}:\d{2} [APap][Mm])$/;
        const matches = fields.time.match(timeRegex);

        if (matches && matches.length === 3) {
            slot.date = matches[1];
            slot.time = matches[2];
        } else {
            console.log("Invalid time format: " + fields.time);
            // Handle the invalid time format case here
            return;
        }

        console.log("Date: " + slot.date);
        console.log("Time: " + slot.time);
        slot.semester = getSemester()
        collection.find({
            asuID: fields.asuID
        }).toArray().then(results => {
            if (results.length == 0) {
                // saveApplicationFile(files.hourFile, `${fields.asuID}.hours.pdf`)
                saveInterviewToDb(slot)
                db.collection('applications').updateOne({
                    'asuID': asuID,
                    'semester': getSemester(),
                    'status': "Emailed"
                }, {
                    $set: {
                        'scheduled': 2
                    }
                })
                res.render('FailedLoginInterview', {
                    title: 'Login Failed',
                    message: 'Slot booking successful. You will receive a confirmation mail within 1 bussiness day'
                })
            } else {
                // application exists as 'rejected' or as a previously entered application
                res.render('FailedLoginInterview', {
                    title: 'Login Failed',
                    message: 'You have already booked a slot.'
                })
            }
        })

    })
}

const saveInterviewToDb = slot => {
    const db = _db.getDb()
    const collection = db.collection('interviewSchedule')

    collection.insertOne(slot, (err, result) => {
        if (err) logger.error(err)
        else logger.info(`Inserted ${slot} to db.`)
    });
}

const getInterviewSlots = (req, res) => {
    const db = _db.getDb();

    // Fetch data from the 'applications' table
    db.collection('interviewSchedule').find().toArray().then(interviewSchedule => {
        // Filter and include only items that are greater than or equal to today
        const today = new Date();
        interviewSchedule = interviewSchedule.filter(item => {
            const dateTime = new Date(`${item.date} ${item.time}`);
            return dateTime >= today;
        });

        // Sort the filtered data based on datetime
        interviewSchedule.sort((a, b) => {
            const dateA = new Date(`${a.date} ${a.time}`);
            const dateB = new Date(`${b.date} ${b.time}`);
            return dateA - dateB;
        });

        // Pass the sorted and filtered data to the rendering function
        res.render('interviewSlots', {
            title: 'Interview Schedule Page',
            appsCount: interviewSchedule.length, // Include applications count
            interviewSchedule: interviewSchedule // Interview schedule data
        });
    });
};



const getSlotSetting = (req, res) => {
    const form = new formidable.IncomingForm();
    const db = _db.getDb();
    const collection = db.collection('instructorSlots');

    form.parse(req, (err, fields) => {
        const instructor = fields.instructor;

        // Define a filter to match documents with the same instructor
        const filter = { instructor: instructor };

        // Delete all documents that match the filter
        collection.deleteMany(filter, (err, deleteResult) => {
            if (err) {
                console.error('Error deleting documents:', err);
            } else {
                console.log(`Deleted ${deleteResult.deletedCount} documents for instructor: ${instructor}`);
            }

            // Loop through the fields and separate time slots by day
            const slots = [];

            // Loop through the fields and separate time slots by day
            for (const key in fields) {
                if (key.startsWith('times[')) {
                    const daySlot = key.match(/\[(.*?)\]/)[1]; // Extract the day-slot combination from the key
                    const [day, time] = daySlot.split('-'); // Split day-slot combination into separate day and time

                    // Adjust the time based on the instructor
                    let adjustedTime = time;
                    if (instructor === 'Diane') {
                        // Add 1 minute for Diane
                        const [hour, minutePart] = time.split(':');
                        const [minute, ampm] = minutePart.split(' ');
                        adjustedTime = `${hour}:${(parseInt(minute) + 1).toString().padStart(2, '0')} ${ampm}`;
                    }

                    slots.push({ instructor: instructor, day: day, time: adjustedTime });
                }
            }

            // Insert the new slot documents as a list
            collection.insertMany(slots, (err, insertResult) => {
                if (err) {
                    console.error('Error inserting documents:', err);
                } else {
                    console.log(`Inserted ${insertResult.insertedCount} documents for instructor: ${instructor}`);
                }
            });
        });
    });
    res.render('FailedLoginInterview', {
        title: 'Success',
        message: 'Slot Booking Successful.'
    })
};

const deleteInterview = (req, res) => {
    const db = _db.getDb()
    let asuID = req.params.asuID
    db.collection('interviewSchedule').deleteOne({
        'asuID': asuID
    }).then(e => {
        if (e.result.ok === 1) {
            db.collection('applications').updateOne({
                'asuID': asuID,
                'semester': getSemester(),
                'status': "Emailed"
            }, {
                $set: {
                    'scheduled': 1
                }
            })
            res.render('FailedLoginInterview', {
                title: 'Success',
                message: 'Deleted Successful.'
            })
        } else {
            console.log('failed')
            res.send('Failed')
        }
    }).catch(err => {
        console.log(err)
        res.send('Error')
    })
};

const saveBusySlot = (req, res) => {
    let form = new formidable.IncomingForm()
    let slot = {}
    const db = _db.getDb()
    const collection = db.collection('interviewSchedule')

    form.parse(req, (err, fields) => {
        slot.asuID = " "
        slot.firstName = "Instructor"
        slot.lastName = "Marked Busy"
        const timeRegex = /^(\w{3} \w{3} \d{2} \d{4}) - (\d{1,2}:\d{2} [APap][Mm])$/;
        const matches = fields.time.match(timeRegex);

        if (matches && matches.length === 3) {
            slot.date = matches[1];
            slot.time = matches[2];
        } else {
            console.log("Invalid time format: " + fields.time);
            // Handle the invalid time format case here
            return;
        }

        console.log("Date: " + slot.date);
        console.log("Time: " + slot.time);
        slot.semester = getSemester()
        collection.insertOne(slot, (err, result) => {
            if (err) logger.error(err)
            else logger.info(`Inserted ${slot} to db.`)
    });
    })
    res.render('FailedLoginInterview', {
        title: 'Success',
        message: 'Slot Booking Successful.'
    })
}


module.exports = {
    saveApplicationFile,
    saveApplicantToDb,
    saveHoursAvailable,
    saveApplication,
    saveUpdatedTranscript,
    saveUpdatedHoursAvailable,
    getSemester,
    getDate,
    getFormattedDate,
    getEmail,
    getSemestersList,
    renderAdmin,
    verify,
    verifyHR,
    verifyEmployee,
    getApplicantDetails,
    updateApplicantDetails,
    deleteApplication,
    renderInterviews,
    sendEmail,
    saveInterviews,
    renderHR,
    renderHRSearch,
    renderInterviewSummariesHR,
    saveUpdatedHoursFormFallSpring,
    saveUpdatedHoursFormSummer,
    getApplicanthoursAvailable,
    getAllApplicanthours,
    getEmployeeHours,
    getEmployeeHoursSummer,
    getApplicantHours,
    getApplicantHoursSummer,
    getEmployeeDetailHours,
    getEmployeeDetailHoursSummer,
    getApplicantDetailHours,
    getApplicantDetailHoursSummer,
    //New Application
    saveApplicationPdf,
    calculateSemester,
    getUpdatedTranscripts,
    validInterview,
    saveInterviewSlot,
    saveInterviewToDb,
    getInterviewSlots,
    getSlotSetting,
    deleteInterview,
    saveBusySlot
}
