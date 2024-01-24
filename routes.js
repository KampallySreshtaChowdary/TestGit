const router = require('express').Router()
const formidable = require('formidable')
const functions = require('./functions')
const passport = require('passport')
const Strategy = require('passport-local').Strategy
const _db = require('./db')
const logger = require('./logger')
const timeSlots = require('./timeSlots')

router.get('/', (req, res) => {
    res.render('landing', {
        title: 'GIA',
    })
})

router.get('/applicant', (req, res) => {
    res.render('applicant', {
        title: 'Application page',
    })
})

router.get('/applicant/update', (req, res) => {
    res.render('applicant-update-hours', {
        title: 'Update Hours Available'
    })
})

//New Application
router.get('/onlineapplicationform', (req, res) => {
    res.render('onlineapplicationform', {
        title: 'Application Form',
    })
})

//New Application
router.post('/submit/application', functions.saveApplicationPdf)

router.post('/upload/application', functions.saveApplication)

router.get('/upload/application', (req, res) => res.redirect('/gia/applicant'))

router.post('/upload/hoursAvailable', (req, res) => {

    let form = new formidable.IncomingForm()

    form.parse(req, (err, fields, files) => {

        functions.saveHoursAvailable(files.hoursAvailableFile, `${fields.asuID}.${fields.session}.pdf`)
    })

    res.render('confirmation', {
        title: 'Thank you',
        message : 'Your hoursAvailable form was successfully uploaded.'
    })
})

router.post('/upload/transcript', (req, res) => {

    let form = new formidable.IncomingForm()

    form.parse(req, (err, fields, files) => {

        functions.saveUpdatedTranscript(files.updatedTranscriptFile, `${fields.asuID}`)
    })

    res.render('confirmation', {
        title: 'Thank you',
        message : 'Your updated transcript was successfully uploaded.'
    })
})

router.post('/upload/updatedHoursAvailable', (req, res) => {

    let form = new formidable.IncomingForm()

    form.parse(req, (err, fields, files) => {

        functions.saveUpdatedHoursAvailable(files.updatedHoursAvailableFile, `${fields.asuID}.${fields.session}.pdf`)
    })

    res.render('confirmation', {
        title: 'Thank you',
        message : 'Your updated hours available was successfully uploaded.'
    })
})

router.get('/upload/hoursAvailable', (req, res) => res.redirect('/gia/employee'))
router.get('/upload/transcript', (req, res) => res.redirect('/gia/employee'))

router.get('/employee', (req, res, next) => {
    if (req.user)
        next()
    else res.redirect('/gia/login')
}, (req, res) => {
    res.render('employee', {
        title: 'Logged in as ' + req.user.role,
        schedule: timeSlots.fall_spring.schedule,
        mwfSlots: timeSlots.fall_spring.mwfSlots,
        mwSlots : timeSlots.fall_spring.mwSlots,
        tthSlots: timeSlots.fall_spring.tthSlots,
    })
})

router.get('/admin', functions.verify, (req, res) => functions.renderAdmin(req.body, res))

router.post('/admin', functions.verify, (req, res) => functions.renderAdmin(req.body, res))

router.get('/admin/applicant/:asuID/:semester', functions.verify, functions.getApplicantDetails)

router.post('/admin/applicant/update', functions.verify, functions.updateApplicantDetails)

router.post('/admin/applicant/delete', functions.verify, functions.deleteApplication)

router.post('/admin/applicant/email', functions.verify, functions.sendEmail)

router.get('/admin/applicant/interview/:asuID/:semester/:set', functions.renderInterviews)

router.post('/admin/applicant/interview/save', functions.saveInterviews)

router.get('/hr', functions.verifyHR, functions.renderHR)

router.post('/hr', functions.verifyHR, functions.renderHRSearch)

router.get('/hr/summary/:asuID/:semester', functions.verifyHR, functions.renderInterviewSummariesHR)

router.post('/employee/updatedHoursFallSpring/save', functions.saveUpdatedHoursFormFallSpring)

router.post('/employee/updatedHoursSummer/save', functions.saveUpdatedHoursFormSummer)



router.get('/employee/updateHoursFormFallSpring', (req, res, next) => {
    if (req.user)
        next()
    else res.redirect('/gia/login')
}, (req, res) => {
    res.render('updateHoursFallSpring', {
        title: 'Update hours - Employee',
        schedule: timeSlots.fall_spring.schedule,
        mwfSlots: timeSlots.fall_spring.mwfSlots,
        mwSlots : timeSlots.fall_spring.mwSlots,
        tthSlots: timeSlots.fall_spring.tthSlots,
    })
})

router.get('/applicant/updateHoursFormFallSpring', (req, res) => {
    res.render('updateHoursFallSpring', {
        title: 'Update hours',
        schedule: timeSlots.fall_spring.schedule,
        mwfSlots: timeSlots.fall_spring.mwfSlots,
        mwSlots : timeSlots.fall_spring.mwSlots,
        tthSlots: timeSlots.fall_spring.tthSlots,
    })
})

router.get('/employee/updateHoursFormSummer', (req, res, next) => {
    if (req.user)
        next()
    else res.redirect('/gia/login')
}, (req, res) => {
    res.render('updateHoursSummer', {
        title: 'Update hours - Employee',
        schedule: timeSlots.summer.schedule,
        //summerSlots: timeSlots.summer.slots
        sumAorBSlots: timeSlots.summer.sumAorBSlots,
        sumCSlots: timeSlots.summer.sumCSlots
    })
})

router.get('/applicant/updateHoursFormSummer', (req, res) => {
    res.render('updateHoursSummer', {
        title: 'Update hours',
        schedule: timeSlots.summer.schedule,
        //summerSlots: timeSlots.summer.slots
        sumAorBSlots: timeSlots.summer.sumAorBSlots,
        sumCSlots: timeSlots.summer.sumCSlots
    })
})

router.get('/login', (req, res, next) => {
    if (req.user) {
        switch (req.user.role) {
            case 'student':
                res.redirect('/gia/employee')
                break
            case 'admin':
                res.redirect('/gia/admin')
                break
            case 'hr':
                res.redirect('/gia/hr')
                break
        }
    } else next()
}, (req, res) => {
    res.render('login', {
        title: 'Login to GIA',
        heading: 'Welcome to the GIA login page'
    })
})

router.get('/logout', (req, res) => {
    req.logout()
    res.redirect('/gia/login')
})

passport.use(new Strategy((username, password, cb) => {
    const db = _db.getDb()
    db.collection('users').find({
        'username': username,
        'password': password
    }).toArray((err, user) => {
        if (err) {
            return cb(err)
        }
        if (user.length === 0) {
            return cb(null, false)
        }
        return cb(null, user[0])
    })
}))

passport.serializeUser((user, done) => {
    done(null, user)
})

passport.deserializeUser((user, done) => {
    done(null, user)
})

router.post('/login', passport.authenticate('local', {
    failureRedirect: '/gia/login'
}), (req, res) => {
    switch (req.user.role) {
        case 'employee':
            res.redirect('/gia/employee')
            break
        case 'admin':
            res.redirect('/gia/admin')
            break
        case 'hr':
            res.redirect('/gia/hr')
            break
    }
})

router.get('/admin/applications/:asuID/:semester', functions.verify, functions.getApplicanthoursAvailable)

router.get('/admin/employeeApplications/:asuID/:semester', functions.verify, functions.getEmployeeDetailHours)
router.get('/admin/employeeApplicationsSummer/:asuID/:semester', functions.verify, functions.getEmployeeDetailHoursSummer)
router.get('/admin/applicantApplications/:asuID/:semester', functions.verify, functions.getApplicantDetailHours)
router.get('/admin/applicantApplicationsSummer/:asuID/:semester', functions.verify, functions.getApplicantDetailHoursSummer)


router.get('/admin/employeeHours', functions.verify, functions.getEmployeeHours)
router.get('/admin/employeeHoursSummer', functions.verify, functions.getEmployeeHoursSummer)
router.get('/admin/applicantHours', functions.verify, functions.getApplicantHours)
router.get('/admin/applicantHoursSummer', functions.verify, functions.getApplicantHoursSummer)

router.get('/admin/hoursmenu', (req, res) => {
    res.render('hours-menu', {
        title: 'Hours Menu'
    })
})

router.get('/admin/updatedTranscripts', functions.verify, functions.getUpdatedTranscripts)

router.get('/interviewScheduleLogin', (req, res) => {
    res.render('interviewScheduleLogin', {
        title: 'Interview Schedule Login Page',
    })
})

router.post('/interviewScheduleLogin', functions.validInterview)

router.post('/slotBooking', functions.saveInterviewSlot)

router.get('/admin/interviewConfirmation', functions.verify, functions.getInterviewSlots)
router.post('/admin/slotSetting', functions.getSlotSetting)
router.get('/admin/instructorSlots', (req, res) => {
    res.render('instructorSlots', {
            title: 'Interview Slot Setting'
    });
})

router.get('/admin/previousSlots', (req, res) => {
    const db = _db.getDb()
    db.collection('instructorSlots').find().toArray().then(instructorSlots => {
    //db.collection('updatedHoursAvailable').find().sort({lastModified: -1}).toArray().then(hoursAvailable => {
        let database = instructorSlots;

        res.render('setSlots', {
            title: 'Selected Slots',
            appsCount: database.length,
            updatedHours: database})
    });
})

router.get('/admin/instructorMarkBusy', (req, res) => {
    const db = _db.getDb()
    db.collection('interviewSchedule').find().sort({lastModified: -1}).toArray().then(interviewSchedule => {
        let database = interviewSchedule;
        db.collection('instructorSlots').find().toArray().then(instructorSlots => {
            let slotDb = instructorSlots
            res.render('interviewMarkBusy', {
                title: 'Instructor Mark Busy',
                interviewSchedule: database,
                instructorSlots: slotDb
            })
        })
        
            
    })
    
})

router.get('/admin/interviewDelete/:asuID', functions.deleteInterview)

router.post('/admin/markBusy', functions.saveBusySlot)
module.exports = router