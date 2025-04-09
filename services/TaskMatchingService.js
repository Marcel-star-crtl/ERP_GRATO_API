// const Task = require('../models/Task');
// const Tasker = require('../models/Tasker');

// class TaskMatchingService {
//     constructor() {}

//     calculateDistance(lat1, lon1, lat2, lon2) {
//         const R = 6371; // Earth's radius in km
//         const dLat = this.toRad(lat2 - lat1);
//         const dLon = this.toRad(lon2 - lon1);
//         const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
//                 Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
//                 Math.sin(dLon/2) * Math.sin(dLon/2);
//         const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
//         return R * c;
//     }

//     toRad(value) {
//         return value * Math.PI / 180;
//     }

//     isTaskerAvailable(tasker, scheduledTime) {
//         if (!tasker.activeTask) return true;
//         // We could add more sophisticated availability checking if needed
//         return false;
//     }

//     calculateTaskerScore(task, tasker, taskerHistory) {
//         // Base score starts at 100
//         let score = 100;

//         // Distance penalty (reduces score as distance increases)
//         const distance = this.calculateDistance(
//             task.location.coordinates[1],
//             task.location.coordinates[0],
//             tasker.currentLocation.coordinates[1],
//             tasker.currentLocation.coordinates[0]
//         );
//         score -= (distance * 2); // -2 points per km

//         // Category experience bonus
//         const categoryTasks = taskerHistory.filter(t => t.category === task.category).length;
//         score += (categoryTasks * 5); // +5 points per completed task in category

//         // Rating bonus
//         if (tasker.rating) {
//             score += (tasker.rating * 10); // +10 points per rating point
//         }

//         return Math.max(0, score); // Ensure score doesn't go negative
//     }

//     async findBestMatch(task) {
//         const taskers = await Tasker.find({
//             currentLocation: {
//                 $near: {
//                     $geometry: task.location,
//                     $maxDistance: 50000 // 50km
//                 }
//             },
//             skills: task.category,
//             activeTask: null
//         });

//         if (taskers.length === 0) return null;

//         let bestMatch = null;
//         let highestScore = -1;

//         for (const tasker of taskers) {
//             // Get tasker's history
//             const taskerHistory = await Task.find({
//                 assignedTasker: tasker._id,
//                 status: 'completed'
//             }).sort({ completedAt: -1 }).limit(50);

//             const score = this.calculateTaskerScore(task, tasker, taskerHistory);

//             if (score > highestScore) {
//                 highestScore = score;
//                 bestMatch = tasker;
//             }
//         }

//         return bestMatch;
//     }
// }

// module.exports = new TaskMatchingService();










const User = require('../models/User');
const Task = require('../models/Task');

class TaskMatchingService {
    constructor() {}

    calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth's radius in km
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    toRad(value) {
        return value * Math.PI / 180;
    }

    isTaskerAvailable(doer, scheduledTime) {
        if (!doer.doerProfile.activeTask) {
            const scheduleDate = new Date(scheduledTime);
            // Convert UTC to local time for proper day calculation
            const day = scheduleDate.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const hours = scheduleDate.getUTCHours();
            const minutes = scheduleDate.getUTCMinutes();
            const time = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            console.log(`Checking availability for day: ${day}, time: ${time}`);

            const daySchedule = doer.doerProfile.availability.schedule.find(
                schedule => schedule.day === day && schedule.available
            );

            if (daySchedule) {
                console.log(`Found schedule for ${day}:`, daySchedule);
                const isAvailable = time >= daySchedule.hours.from && time <= daySchedule.hours.to;
                console.log(`Time check: ${time} is ${isAvailable ? 'within' : 'outside'} schedule ${daySchedule.hours.from}-${daySchedule.hours.to}`);
                return isAvailable;
            }
            console.log(`No schedule found for ${day} or day is not available`);
        }
        console.log('Tasker has an active task');
        return false;
    }

    async findBestMatch(task) {
        try {
            console.log('Finding match for task:', task);

            // Debug: Print all doers before filtering
            const allDoers = await User.find({ role: 'doer' });
            console.log('All doers in system:', allDoers.length);

            // Create a case-insensitive regex for category matching
            const categoryRegex = new RegExp(`^${task.category}$`, 'i');

            // First, find doers with matching category
            const doersWithCategory = await User.find({
                role: 'doer',
                'doerProfile.services': {
                    $elemMatch: {
                        category: categoryRegex
                    }
                }
            });
            console.log(`Found ${doersWithCategory.length} doers with matching category (case-insensitive)`);

            // Then, apply geo query
            const doers = await User.find({
                role: 'doer',
                'doerProfile.currentLocation': {
                    $near: {
                        $geometry: task.location,
                        $maxDistance: 50000 // Increased to 50km for testing
                    }
                },
                'doerProfile.services': {
                    $elemMatch: {
                        category: categoryRegex
                    }
                },
                'doerProfile.activeTask': null,
                'doerProfile.availability.status': 'available'
            }).populate('doerProfile');

            console.log(`Found ${doers.length} potential doers within radius`);

            // Debug: Print detailed info about each doer's services and location
            doers.forEach(doer => {
                console.log(`\nDoer ${doer._id}:`);
                console.log('Services:', doer.doerProfile.services);
                console.log('Current Location:', doer.doerProfile.currentLocation);
                console.log('Availability Status:', doer.doerProfile.availability.status);
                console.log('Active Task:', doer.doerProfile.activeTask);
                if (doer.doerProfile.currentLocation && doer.doerProfile.currentLocation.coordinates) {
                    const distance = this.calculateDistance(
                        task.location.coordinates[1],
                        task.location.coordinates[0],
                        doer.doerProfile.currentLocation.coordinates[1],
                        doer.doerProfile.currentLocation.coordinates[0]
                    );
                    console.log('Distance from task:', distance.toFixed(2), 'km');
                }
            });

            if (doers.length === 0) {
                // More detailed debugging for why no matches were found
                const doersWithServices = await User.find({
                    role: 'doer',
                    'doerProfile.services.0': { $exists: true }
                });
                
                console.log('\nDetailed debugging for all doers with services:');
                doersWithServices.forEach(doer => {
                    console.log(`\nDoer ${doer._id}:`);
                    console.log('Services:', doer.doerProfile.services);
                    console.log('Location:', doer.doerProfile.currentLocation);
                    console.log('Active Task:', doer.doerProfile.activeTask);
                    console.log('Availability Status:', doer.doerProfile.availability.status);
                });
                
                return null;
            }

            let bestMatch = null;
            let highestScore = -1;

            for (const doer of doers) {
                // Check if within doer's service radius
                const distance = this.calculateDistance(
                    task.location.coordinates[1],
                    task.location.coordinates[0],
                    doer.doerProfile.currentLocation.coordinates[1],
                    doer.doerProfile.currentLocation.coordinates[0]
                );

                const maxRadius = doer.doerProfile.serviceRadius?.distance || 20;
                
                if (distance <= maxRadius && this.isTaskerAvailable(doer, task.scheduledTime)) {
                    const taskerHistory = await Task.find({
                        assignedTasker: doer._id,
                        status: 'completed'
                    }).sort({ completedAt: -1 }).limit(50);

                    const score = this.calculateTaskerScore(task, doer, taskerHistory);
                    console.log(`Doer ${doer._id} scored: ${score} at distance: ${distance}km`);

                    if (score > highestScore) {
                        highestScore = score;
                        bestMatch = doer;
                    }
                }
            }

            return bestMatch;
        } catch (error) {
            console.error('Error in findBestMatch:', error);
            throw error;
        }
    }

    calculateTaskerScore(task, doer, taskerHistory) {
        let score = 100;

        // Distance penalty (reduces score as distance increases)
        const distance = this.calculateDistance(
            task.location.coordinates[1],
            task.location.coordinates[0],
            doer.doerProfile.currentLocation.coordinates[1],
            doer.doerProfile.currentLocation.coordinates[0]
        );
        score -= (distance * 2); // -2 points per km

        // Service matching bonus
        const matchingService = doer.doerProfile.services.find(
            service => service.category.toLowerCase() === task.category.toLowerCase()
        );
        if (matchingService) {
            score += 20;
        }

        // Category experience bonus
        const categoryTasks = taskerHistory.filter(t => 
            t.category.toLowerCase() === task.category.toLowerCase()
        ).length;
        score += (categoryTasks * 5);

        // Rating bonus
        if (doer.doerProfile.ratings.average) {
            score += (doer.doerProfile.ratings.average * 10);
        }

        // Completion rate bonus
        if (doer.doerProfile.completedTasks > 0) {
            score += Math.min(doer.doerProfile.completedTasks * 2, 50);
        }

        return Math.max(0, score);
    }
}

module.exports = new TaskMatchingService();