

import { Chart, Student, GeneratedRowsLayout, GeneratedGroupsLayout, RowsLayoutDetails, Group, Desk, Constraints, UnplacedStudentInfo, LevelConsiderationOptions } from '../types';
import { DEFAULT_STUDENT_CONSTRAINTS, DEFAULT_ROWS_LAYOUT } from '../constants';

const generateManualRowsLayout = (chart: Chart): GeneratedRowsLayout => {
    const { layoutDetails, students } = chart;
    const { columnConfiguration, teacherDeskPosition } = layoutDetails as RowsLayoutDetails;
    const desks: Desk[] = [];
    const numCols = columnConfiguration.length;
    const maxRows = Math.max(0, ...columnConfiguration);

    // Create desks based on the flexible column configuration
    for (let col = 1; col <= numCols; col++) {
        const rowsInCol = columnConfiguration[col - 1];
        for (let row = 1; row <= rowsInCol; row++) {
            desks.push({ row, col, students: [] });
        }
    }

    // Helper to gracefully handle seat constraints
    const getPreferredSeats = (constraints?: Constraints): number[] => {
        const c = { ...DEFAULT_STUDENT_CONSTRAINTS, ...constraints };
        // If allowedSeats is not specified (null or undefined), or is an empty array, it means any seat is fine.
        if (c.allowedSeats == null || c.allowedSeats.length === 0) {
            return [1, 2]; // Default to both seats
        }
        // Otherwise, use the specific seats provided.
        return c.allowedSeats;
    };
    
    const getStudentById = (id: string) => students.find(s => s.id === id);

    const checkDeskPositionConstraints = (student: Student, deskRelativeRow: number, deskRelativeCol: number): boolean => {
        const constraints: Constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(student.constraints || {}) };
    
        if (constraints.allowedCols && constraints.allowedCols.length > 0 && !constraints.allowedCols.includes(deskRelativeCol)) {
            return false;
        }
    
        if (constraints.allowedRows && constraints.allowedRows.length > 0) {
            const wantedRelativeRows = constraints.allowedRows;
            if (!wantedRelativeRows.includes(deskRelativeRow)) return false;
        }
        
        return true;
    };
    
    const canSitTogether = (s1: Student, s2: Student): boolean => {
        const s1DontSit = s1.constraints.dontSitWith || [];
        const s2DontSit = s2.constraints.dontSitWith || [];
        
        return !s1DontSit.includes(s2.id) && !s2DontSit.includes(s1.id);
    };

    const hasForbiddenNeighbor = (student: Student, row: number, col: number): boolean => {
        const dontSitWithIds = student.constraints.dontSitWith || [];
        if (dontSitWithIds.length === 0) return false;
        
        const neighbors = [
            { r: row - 1, c: col }, { r: row + 1, c: col },
            { r: row, c: col - 1 }, { r: row, c: col + 1 },
            { r: row - 1, c: col - 1 }, { r: row - 1, c: col + 1 },
            { r: row + 1, c: col - 1 }, { r: row + 1, c: col + 1 },
        ];

        for (const neighbor of neighbors) {
            const desk = desks.find(d => d.row === neighbor.r && d.col === neighbor.c);
            if (desk?.students.some(s => dontSitWithIds.includes(s.id))) {
                return true;
            }
        }
        return false;
    };

    const placedStudents = new Set<string>();
    const unplacedReasons = new Map<string, string>();
    const studentsToProcess = [...students].sort(() => Math.random() - 0.5);

    // --- START: NEW MULTI-PASS PLACEMENT LOGIC ---

    // 1. Place students with fully fixed seats and check for conflicts
    const fixedSeatAssignments = new Map<string, Student[]>(); // "row-col-seat" -> [student, ...]
    studentsToProcess.forEach(student => {
        const c = student.constraints;
        if (c.allowedRows?.length === 1 && c.allowedCols?.length === 1 && c.allowedSeats?.length === 1) {
            const key = `${c.allowedRows[0]}-${c.allowedCols[0]}-${c.allowedSeats[0]}`;
            if (!fixedSeatAssignments.has(key)) fixedSeatAssignments.set(key, []);
            fixedSeatAssignments.get(key)!.push(student);
        }
    });

    fixedSeatAssignments.forEach((assignedStudents, key) => {
        if (assignedStudents.length > 1) {
            const [row, col, seat] = key.split('-');
            const reason = `שיבוץ קבוע מתנגש עם תלמידים אחרים באותו מקום (שורה ${row}, טור ${col}, כיסא ${seat}).`;
            assignedStudents.forEach(student => unplacedReasons.set(student.id, reason));
        } else {
            const student = assignedStudents[0];
            const [row, col, seat] = key.split('-').map(Number);
            const desk = desks.find(d => d.row === row && d.col === col);
            
            if (desk) {
                if (desk.students.length < 2) {
                    desk.students.push({ name: student.name, seat, id: student.id });
                    placedStudents.add(student.id);
                } else {
                     unplacedReasons.set(student.id, `שולחן (${row}-${col}) כבר תפוס במלואו.`);
                }
            } else {
                unplacedReasons.set(student.id, `המקום שנקבע (${row}-${col}-${seat}) אינו קיים.`);
            }
        }
    });
    
    const placeIndividual = (student: Student): boolean => {
        if (placedStudents.has(student.id)) return true;
        const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...student.constraints };
        
        // Try empty desks first to maximize desk usage and respect 'sitAlone'
        for (const desk of desks) {
            if (desk.students.length === 0) {
                if (!checkDeskPositionConstraints(student, desk.row, desk.col)) continue;
                if (hasForbiddenNeighbor(student, desk.row, desk.col)) continue;
                
                const preferredSeats = getPreferredSeats(student.constraints);
                if (preferredSeats.length > 0) {
                    desk.students.push({ name: student.name, seat: preferredSeats[0], id: student.id });
                    placedStudents.add(student.id);
                    return true;
                }
            }
        }

        // Then try to fill half-empty desks (only if student doesn't need to sit alone)
        if (!constraints.sitAlone) {
            for (const desk of desks) {
                if (desk.students.length === 1) {
                     const occupant = students.find(s => s.id === desk.students[0].id);
                     if (occupant?.constraints.sitAlone) continue;
                     if (!checkDeskPositionConstraints(student, desk.row, desk.col)) continue;
                     if (occupant && !canSitTogether(student, occupant)) continue;
                     if (hasForbiddenNeighbor(student, desk.row, desk.col)) continue;
        
                     const occupiedSeats = desk.students.map(s => s.seat);
                     const preferredSeats = getPreferredSeats(student.constraints);
                     const availableSeat = preferredSeats.find(seat => !occupiedSeats.includes(seat));
                     if (availableSeat) {
                         desk.students.push({ name: student.name, seat: availableSeat, id: student.id });
                         placedStudents.add(student.id);
                         return true;
                     }
                }
            }
        }
        return false;
    };
    
    // Pass 2: Place 'sitWith' pairs - This is a highly rigid constraint.
    const studentsInPairs = new Set<string>();
    const pairsToPlace: [Student, Student][] = [];
    studentsToProcess.forEach(student => {
        if (placedStudents.has(student.id) || studentsInPairs.has(student.id)) return;
        const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...student.constraints };
        if (constraints.sitWith?.length > 0) {
            const partner = students.find(s => s.id === constraints.sitWith[0]);
            if (partner && !placedStudents.has(partner.id) && !studentsInPairs.has(partner.id)) {
                pairsToPlace.push([student, partner]);
                studentsInPairs.add(student.id);
                studentsInPairs.add(partner.id);
            }
        }
    });
    
    // --- START: SMARTER PAIR PLACEMENT ---
    const scoredPairs = pairsToPlace.map(pair => {
        const [studentA, studentB] = pair;
        let validDesksCount = 0;
        for (const desk of desks) {
            if (desk.students.length === 0 &&
                checkDeskPositionConstraints(studentA, desk.row, desk.col) &&
                checkDeskPositionConstraints(studentB, desk.row, desk.col)) {
                validDesksCount++;
            }
        }
        return { pair, score: validDesksCount };
    });

    scoredPairs.sort((a, b) => a.score - b.score);

    for (const { pair } of scoredPairs) {
        const [student, partner] = pair;
        let pairPlaced = false;
        for (const desk of desks) {
            if (desk.students.length === 0 && 
                checkDeskPositionConstraints(student, desk.row, desk.col) && 
                checkDeskPositionConstraints(partner, desk.row, desk.col) && 
                canSitTogether(student, partner) &&
                !hasForbiddenNeighbor(student, desk.row, desk.col) &&
                !hasForbiddenNeighbor(partner, desk.row, desk.col)
            ) {
                const studentSeats = getPreferredSeats(student.constraints);
                const partnerSeats = getPreferredSeats(partner.constraints);
                
                if (studentSeats.includes(1) && partnerSeats.includes(2)) {
                    desk.students.push({ name: student.name, seat: 1, id: student.id }, { name: partner.name, seat: 2, id: partner.id });
                    pairPlaced = true;
                } else if (studentSeats.includes(2) && partnerSeats.includes(1)) {
                    desk.students.push({ name: student.name, seat: 2, id: student.id }, { name: partner.name, seat: 1, id: partner.id });
                    pairPlaced = true;
                }
                
                if (pairPlaced) {
                    placedStudents.add(student.id);
                    placedStudents.add(partner.id);
                    break;
                }
            }
        }
         if (!pairPlaced) {
            const reason = `לא נמצא שולחן ריק פנוי עבור הזוג "${student.name}" ו-"${partner.name}" שעומד בהעדפות המיקום של שניהם.`;
            unplacedReasons.set(student.id, reason);
            unplacedReasons.set(partner.id, reason);
        }
    }
    // --- END: SMARTER PAIR PLACEMENT ---

    // Pass 3: Place 'sitAlone' students - another rigid constraint.
    const sitAloneStudents = studentsToProcess.filter(s => 
        s.constraints.sitAlone && !placedStudents.has(s.id) && !unplacedReasons.has(s.id)
    );

    for (const student of sitAloneStudents) {
         let placed = false;
         for (const desk of desks) {
             if (desk.students.length === 0 && checkDeskPositionConstraints(student, desk.row, desk.col)) {
                 desk.students.push({ name: student.name, seat: 1, id: student.id });
                 placedStudents.add(student.id);
                 placed = true;
                 break;
             }
         }
         if (!placed) {
             unplacedReasons.set(student.id, "לא נמצא שולחן ריק עבור העדפת 'חייב לשבת לבד'.");
         }
    }

    // Pass 4: Place students with positional constraints.
    const positionalStudents = studentsToProcess.filter(s => {
        if (placedStudents.has(s.id) || unplacedReasons.has(s.id)) return false;
        if (s.constraints.sitAlone || studentsInPairs.has(s.id)) return false;
        const c = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(s.constraints || {}) };
        return (c.allowedRows && c.allowedRows.length > 0) || (c.allowedCols && c.allowedCols.length > 0);
    });

    const getFlexibilityScore = (student: Student): number => {
        const c = { ...DEFAULT_STUDENT_CONSTRAINTS, ...(student.constraints || {}) };
        const rowOptions = c.allowedRows?.length || maxRows;
        const colOptions = c.allowedCols?.length || numCols;
        const seatOptions = c.allowedSeats?.length || 2;
        return rowOptions * colOptions * seatOptions;
    };
    positionalStudents.sort((a, b) => getFlexibilityScore(a) - getFlexibilityScore(b));


    for (const student of positionalStudents) {
        if (!placeIndividual(student)) {
            unplacedReasons.set(student.id, "לא נמצא מקום פנוי שעומד בהעדפות המיקום.");
        }
    }
    
    // --- END NEW MULTI-PASS LOGIC ---

    let remainingStudents = studentsToProcess.filter(s => !placedStudents.has(s.id) && !unplacedReasons.has(s.id));

    // --- START: PASS 4.5 - UPGRADED SMART SEATING STRATEGIES ---
    const { levelConsideration } = layoutDetails as RowsLayoutDetails;
    const strategyOptions: LevelConsiderationOptions = { 
        ...DEFAULT_ROWS_LAYOUT.levelConsideration!, 
        ...levelConsideration 
    };
    
    if (Object.values(strategyOptions).some(v => v)) {
        const studentsForPlacement = [...remainingStudents];
        const challenging = new Map(studentsForPlacement.filter(s => s.behaviorLevel !== undefined && s.behaviorLevel <= 2).map(s => [s.id, s]));
        const strong = new Map(studentsForPlacement.filter(s => s.academicLevel !== undefined && s.academicLevel >= 4).map(s => [s.id, s]));
        const weak = new Map(studentsForPlacement.filter(s => s.academicLevel !== undefined && s.academicLevel <= 2).map(s => [s.id, s]));

        const edgeDesks = desks.filter(d => 
            d.row === 1 || 
            d.col === 1 || 
            d.col === numCols || 
            d.row === columnConfiguration[d.col - 1] // Last desk in its specific column
        );

        // Local helpers for this block
        const placePairInDesks = (s1: Student, s2: Student, targetDesks: Desk[]): boolean => {
            for (const desk of targetDesks) {
                if (desk.students.length === 0 && checkDeskPositionConstraints(s1, desk.row, desk.col) && checkDeskPositionConstraints(s2, desk.row, desk.col) && canSitTogether(s1, s2)) {
                    const s1Seats = getPreferredSeats(s1.constraints);
                    const s2Seats = getPreferredSeats(s2.constraints);
                    if ((s1Seats.includes(1) && s2Seats.includes(2)) || (s1Seats.includes(2) && s2Seats.includes(1))) {
                        desk.students.push({ name: s1.name, seat: s1Seats.includes(1) ? 1 : 2, id: s1.id }, { name: s2.name, seat: s1Seats.includes(1) ? 2 : 1, id: s2.id });
                        placedStudents.add(s1.id);
                        placedStudents.add(s2.id);
                        return true;
                    }
                }
            }
            return false;
        };

        const placeIndividualInDesks = (student: Student, targetDesks: Desk[]): boolean => {
            // Try empty desks first to maximize desk usage
            for (const desk of targetDesks) {
                if (desk.students.length === 0 && checkDeskPositionConstraints(student, desk.row, desk.col)) {
                    desk.students.push({ name: student.name, seat: getPreferredSeats(student.constraints)[0], id: student.id });
                    placedStudents.add(student.id);
                    return true;
                }
            }

            // Then try to fill half-empty desks
            for (const desk of targetDesks) {
                if (desk.students.length === 1) {
                    const occupant = students.find(s => s.id === desk.students[0].id);
                    if (!occupant || occupant.constraints.sitAlone || !canSitTogether(student, occupant) || !checkDeskPositionConstraints(student, desk.row, desk.col)) continue;
                    const availableSeat = getPreferredSeats(student.constraints).find(s => s !== desk.students[0].seat);
                    if (availableSeat) {
                        desk.students.push({ name: student.name, seat: availableSeat, id: student.id });
                        placedStudents.add(student.id);
                        return true;
                    }
                }
            }
            return false;
        };

        // 2. High-priority combo: Place weak & challenging students with strong partners at the edges
        if (strategyOptions.challenge_at_edges && strategyOptions.strong_weak_neighbor) {
            const weakAndChallenging = Array.from(weak.values()).filter(s => challenging.has(s.id));
            for (const wcStudent of weakAndChallenging) {
                if (placedStudents.has(wcStudent.id)) continue;
                let paired = false;
                for (const sStudent of Array.from(strong.values())) {
                    if (placedStudents.has(sStudent.id)) continue;
                    if (placePairInDesks(wcStudent, sStudent, edgeDesks)) {
                        [challenging, strong, weak].forEach(map => { map.delete(wcStudent.id); map.delete(sStudent.id); });
                        paired = true;
                        break;
                    }
                }
            }
        }
        
        // 3. Standard strong-weak pairing in any available desk
        if (strategyOptions.strong_weak_neighbor) {
             for (const wStudent of Array.from(weak.values())) {
                if (placedStudents.has(wStudent.id)) continue;
                for (const sStudent of Array.from(strong.values())) {
                    if (placedStudents.has(sStudent.id)) continue;
                    if (placePairInDesks(wStudent, sStudent, desks)) {
                         [challenging, strong, weak].forEach(map => { map.delete(wStudent.id); map.delete(sStudent.id); });
                        break;
                    }
                }
            }
        }
        
        // 4. Place remaining challenging students at edges
        if (strategyOptions.challenge_at_edges) {
            for (const cStudent of Array.from(challenging.values())) {
                if (placedStudents.has(cStudent.id)) continue;
                if (placeIndividualInDesks(cStudent, edgeDesks)) {
                    [challenging, strong, weak].forEach(map => map.delete(cStudent.id));
                }
            }
        }
    }
    // --- END: UPGRADED SMART SEATING ---


    // 5. Place students with challenging behavior, separating them.
    // Recalculate the pool for subsequent steps.
    // We now include students who might have failed earlier passes (like pairs) to ensure they get placed if possible.
    let individualsToPlace = students.filter(s => !placedStudents.has(s.id));
    
    // Apply 'balanced' strategy sorting if selected. This re-orders the remaining students.
    if (strategyOptions.balanced) {
        const getCombinedScore = (s: Student) => (s.academicLevel || 3) + (s.behaviorLevel || 3);
        const sortedByLevel = individualsToPlace
            .filter(s => s.academicLevel !== undefined || s.behaviorLevel !== undefined)
            .sort((a, b) => getCombinedScore(a) - getCombinedScore(b));
        
        const others = individualsToPlace.filter(s => !sortedByLevel.includes(s));
        const balancedList: Student[] = [];
        while (sortedByLevel.length > 0) {
            balancedList.push(sortedByLevel.pop()!); // highest score
            if (sortedByLevel.length > 0) {
                balancedList.push(sortedByLevel.shift()!); // lowest score
            }
        }
        individualsToPlace = [...balancedList, ...others];
    }

    const BEHAVIOR_THRESHOLD = 2;
    const allChallengingStudentIds = new Set(students
        .filter(s => s.behaviorLevel !== undefined && s.behaviorLevel <= BEHAVIOR_THRESHOLD)
        .map(s => s.id));

    const hasChallengingNeighbor = (row: number, col: number): boolean => {
        const neighbors = [
            { r: row - 1, c: col }, { r: row + 1, c: col },
            { r: row, c: col - 1 }, { r: row, c: col + 1 },
            { r: row - 1, c: col - 1 }, { r: row - 1, c: col + 1 },
            { r: row + 1, c: col - 1 }, { r: row + 1, c: col + 1 },
        ];

        for (const neighbor of neighbors) {
            const desk = desks.find(d => d.row === neighbor.r && d.col === neighbor.c);
            if (desk?.students.some(s => allChallengingStudentIds.has(s.id))) {
                return true;
            }
        }
        return false;
    };

    const challengingStudentsToPlace = individualsToPlace
        .filter(s => allChallengingStudentIds.has(s.id))
        .sort(() => Math.random() - 0.5);

    for (const student of challengingStudentsToPlace) {
        if (placedStudents.has(student.id)) continue;

        const possibleSpots: { desk: Desk; seat: number }[] = [];
        desks.forEach(desk => {
            if (checkDeskPositionConstraints(student, desk.row, desk.col)) {
                if (desk.students.length === 0) {
                    getPreferredSeats(student.constraints).forEach(seat => possibleSpots.push({ desk, seat }));
                } else if (desk.students.length === 1) {
                    const occupant = students.find(s => s.id === desk.students[0].id);
                    if (occupant && !occupant.constraints.sitAlone && canSitTogether(student, occupant)) {
                        const occupiedSeat = desk.students[0].seat;
                        const availableSeats = getPreferredSeats(student.constraints).filter(s => s !== occupiedSeat);
                        if (availableSeats.length > 0) {
                            possibleSpots.push({ desk, seat: availableSeats[0] });
                        }
                    }
                }
            }
        });

        const scoredSpots = possibleSpots.map(spot => ({
            ...spot,
            score: hasChallengingNeighbor(spot.desk.row, spot.desk.col) ? 1 : 0
        }));

        const bestScore = Math.min(...scoredSpots.map(s => s.score).concat([1]));
        const bestSpots = scoredSpots.filter(s => s.score === bestScore);
        
        if (bestSpots.length > 0) {
            const spotToPlace = bestSpots[Math.floor(Math.random() * bestSpots.length)];
            spotToPlace.desk.students.push({ name: student.name, seat: spotToPlace.seat, id: student.id });
            placedStudents.add(student.id);
        }
    }
    
    // Recalculate individuals to place after challenging students have been placed.
    let finalIndividualsToPlace = individualsToPlace.filter(s => !placedStudents.has(s.id));


    // 6. Place remaining students based on gender arrangement
    const { genderArrangement = 'gender_random' } = layoutDetails as RowsLayoutDetails;
    const boys = finalIndividualsToPlace.filter(s => s.gender === 'זכר').sort(() => Math.random() - 0.5);
    const girls = finalIndividualsToPlace.filter(s => s.gender === 'נקבה').sort(() => Math.random() - 0.5);
    const unspecified = finalIndividualsToPlace.filter(s => !s.gender).sort(() => Math.random() - 0.5);

    let finalPlacementList: Student[] = [...unspecified];

    if (genderArrangement === 'gender_mixed') {
        let boysToProcess = [...boys];
        let girlsToProcess = [...girls];
        
        // Pass 1 (IMPROVED): Prioritize filling half-empty desks to create mixed-gender pairs.
        // This handles more constrained placements first.
        const halfEmptyDesks = desks.filter(d => d.students.length === 1);
        for (const desk of halfEmptyDesks) {
            const occupant = students.find(s => s.id === desk.students[0].id);
            if (!occupant || occupant.constraints.sitAlone || !occupant.gender) continue;
            
            const targetGender = occupant.gender === 'זכר' ? 'נקבה' : 'זכר';
            const studentPool = targetGender === 'נקבה' ? girlsToProcess : boysToProcess;
            
            for (let i = studentPool.length - 1; i >= 0; i--) {
                const partner = studentPool[i];
                if (checkDeskPositionConstraints(partner, desk.row, desk.col) && canSitTogether(partner, occupant)) {
                    const occupiedSeats = desk.students.map(s => s.seat);
                    const preferredSeats = getPreferredSeats(partner.constraints);
                    const availableSeat = preferredSeats.find(seat => !occupiedSeats.includes(seat));
                    if (availableSeat) {
                        desk.students.push({ name: partner.name, seat: availableSeat, id: partner.id });
                        placedStudents.add(partner.id);
                        studentPool.splice(i, 1); // Remove the placed student from its pool
                        break; // Desk is now full
                    }
                }
            }
        }

        // Pass 2: Now, use the remaining students to form boy-girl pairs in the empty desks.
        const placePair = (student1: Student, student2: Student, ignorePositional: boolean = false): boolean => {
            for (const desk of desks) {
                if (desk.students.length === 0) {
                    const posOk = ignorePositional || (checkDeskPositionConstraints(student1, desk.row, desk.col) && checkDeskPositionConstraints(student2, desk.row, desk.col));
                    if (posOk && canSitTogether(student1, student2)) {
                        const student1Seats = getPreferredSeats(student1.constraints);
                        const student2Seats = getPreferredSeats(student2.constraints);
            
                        let placed = false;
                        if (student1Seats.includes(1) && student2Seats.includes(2)) {
                            desk.students.push({ name: student1.name, seat: 1, id: student1.id }, { name: student2.name, seat: 2, id: student2.id });
                            placed = true;
                        } else if (student1Seats.includes(2) && student2Seats.includes(1)) {
                            desk.students.push({ name: student1.name, seat: 2, id: student1.id }, { name: student2.name, seat: 1, id: student2.id });
                            placed = true;
                        }
            
                        if (placed) {
                            placedStudents.add(student1.id);
                            placedStudents.add(student2.id);
                            return true;
                        }
                    }
                }
            }
            return false;
        };

        // Pass 2a: Standard pairing (respecting constraints)
        let bIdx = boysToProcess.length - 1;
        while (bIdx >= 0) {
            const boy = boysToProcess[bIdx];
            let paired = false;

            for (let i = girlsToProcess.length - 1; i >= 0; i--) {
                const girl = girlsToProcess[i];
                if (placePair(boy, girl, false)) {
                    paired = true;
                    boysToProcess.splice(bIdx, 1);
                    girlsToProcess.splice(i, 1);
                    break;
                }
            }
            bIdx--;
        }

        // Pass 2b: Desperate pairing (ignoring positional constraints to maintain mixed gender)
        bIdx = boysToProcess.length - 1;
        while (bIdx >= 0 && girlsToProcess.length > 0) {
            const boy = boysToProcess[bIdx];
            let paired = false;

            for (let i = girlsToProcess.length - 1; i >= 0; i--) {
                const girl = girlsToProcess[i];
                if (placePair(boy, girl, true)) {
                    paired = true;
                    boysToProcess.splice(bIdx, 1);
                    girlsToProcess.splice(i, 1);
                    break;
                }
            }
            bIdx--;
        }
        
        // Any students left over are added to the final placement list.
        finalPlacementList.push(...boysToProcess, ...girlsToProcess);

    } else if (genderArrangement === 'gender_same') {
        const pairSameGender = (list: Student[]) => {
            let listToPair = [...list];
            let leftovers: Student[] = [];
            const placePair = (student1: Student, student2: Student): boolean => {
                for (const desk of desks) {
                    if (desk.students.length === 0 && checkDeskPositionConstraints(student1, desk.row, desk.col) && checkDeskPositionConstraints(student2, desk.row, desk.col) && canSitTogether(student1, student2)) {
                        const student1Seats = getPreferredSeats(student1.constraints);
                        const student2Seats = getPreferredSeats(student2.constraints);
            
                        let placed = false;
                        if (student1Seats.includes(1) && student2Seats.includes(2)) {
                            desk.students.push({ name: student1.name, seat: 1, id: student1.id }, { name: student2.name, seat: 2, id: student2.id });
                            placed = true;
                        } else if (student1Seats.includes(2) && student2Seats.includes(1)) {
                            desk.students.push({ name: student1.name, seat: 2, id: student1.id }, { name: student2.name, seat: 1, id: student2.id });
                            placed = true;
                        }
            
                        if (placed) {
                            placedStudents.add(student1.id);
                            placedStudents.add(student2.id);
                            return true;
                        }
                    }
                }
                return false;
            };
            while (listToPair.length >= 2) {
                const s1 = listToPair.pop()!;
                let paired = false;
                for (let i = 0; i < listToPair.length; i++) {
                    const s2 = listToPair[i];
                    if (placePair(s1, s2)) {
                        paired = true;
                        listToPair.splice(i, 1);
                        break;
                    }
                }
                if (!paired) {
                    leftovers.push(s1);
                }
            }
            if (listToPair.length > 0) {
                leftovers.push(...listToPair);
            }
            return leftovers;
        };
        
        const boyLeftovers = pairSameGender(boys);
        const girlLeftovers = pairSameGender(girls);
        finalPlacementList.push(...boyLeftovers, ...girlLeftovers);

    } else { // This will now handle 'gender_random' and any unhandled students from other strategies.
        finalPlacementList.push(...boys, ...girls);
    }
    
    // If we used a sorting strategy like 'balanced', the order is already determined.
    // Otherwise, we sort by behavior level as a default.
    const listToPlace = (strategyOptions.balanced) 
        ? finalPlacementList 
        : finalPlacementList.sort((a,b) => (a.behaviorLevel || 3) - (b.behaviorLevel || 3));

    // Place all remaining individuals
    listToPlace.forEach(student => {
        if (!placedStudents.has(student.id)) {
            let placed = placeIndividual(student);
            
            if (!placed) {
                // Last ditch effort: ignore all constraints except sitAlone and canSitTogether
                const studentConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...student.constraints };
                
                // Sub-pass A: Try to respect gender if gender_mixed is active
                if (genderArrangement === 'gender_mixed' && student.gender) {
                    const targetGender = student.gender === 'זכר' ? 'נקבה' : 'זכר';
                    for (const desk of desks) {
                        if (desk.students.length === 1 && !studentConstraints.sitAlone) {
                            const occupant = students.find(s => s.id === desk.students[0]?.id);
                            if (occupant?.gender === targetGender && !occupant.constraints.sitAlone && canSitTogether(student, occupant)) {
                                const occupiedSeats = desk.students.map(s => s.seat);
                                const seat = [1, 2].find(s => !occupiedSeats.includes(s));
                                if (seat) {
                                    desk.students.push({ name: student.name, seat, id: student.id });
                                    placedStudents.add(student.id);
                                    placed = true;
                                    break;
                                }
                            }
                        }
                    }
                }

                if (!placed) {
                    for (const desk of desks) {
                        if (desk.students.length === 0) {
                            // Empty desk is always fine
                            desk.students.push({ name: student.name, seat: 1, id: student.id });
                            placedStudents.add(student.id);
                            placed = true;
                            break;
                        } else if (desk.students.length === 1 && !studentConstraints.sitAlone) {
                            // Half-full desk is fine if student doesn't need to sit alone and can sit with occupant
                            const occupant = students.find(s => s.id === desk.students[0]?.id);
                            if (occupant?.constraints.sitAlone || (occupant && !canSitTogether(student, occupant))) continue;
                            
                            const occupiedSeats = desk.students.map(s => s.seat);
                            const seat = [1, 2].find(s => !occupiedSeats.includes(s));
                            if (seat) {
                                desk.students.push({ name: student.name, seat, id: student.id });
                                placedStudents.add(student.id);
                                placed = true;
                                break;
                            }
                        }
                    }
                }
            }

            if (!placed) {
                // Only set a generic reason if there isn't already a more specific one from an earlier pass
                if (!unplacedReasons.has(student.id)) {
                    unplacedReasons.set(student.id, "לא נמצא מקום פנוי שעומד בכלל ההעדפות שהוגדרו.");
                }
            } else {
                // If they were placed in this fallback pass, remove any previous failure reason
                unplacedReasons.delete(student.id);
            }
        }
    });
    
    const unplacedStudentsInfo: UnplacedStudentInfo[] = [];
    students.forEach(s => {
        if (!placedStudents.has(s.id)) {
            unplacedStudentsInfo.push({
                name: s.name,
                id: s.id,
                reason: unplacedReasons.get(s.id) || "סיבה לא ידועה. ייתכן שהכיתה מלאה."
            });
        }
    });

    return { desks, unplacedStudents: unplacedStudentsInfo };
};


// --- START: NEW GROUP GENERATION LOGIC WITH CONSTRAINTS ---

// Finds all students connected by "sitWith" constraints starting from a given student.
const findClump = (startStudent: Student, studentMap: Map<string, Student>): Student[] => {
    const clump = new Set<Student>();
    const queue = [startStudent];
    const visitedInClump = new Set<string>([startStudent.id]);

    while (queue.length > 0) {
        const current = queue.shift()!;
        clump.add(current);
        const constraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...current.constraints };
        const sitWithIds = constraints.sitWith || [];
        for (const id of sitWithIds) {
            if (!visitedInClump.has(id)) {
                visitedInClump.add(id);
                const partner = studentMap.get(id);
                if (partner) {
                    queue.push(partner);
                }
            }
        }
    }
    return Array.from(clump);
};

// Forms units of students (clumps for "sitWith", individuals for others)
const formPlacementUnits = (students: Student[], numGroups: number): { units: Student[][], unplacedStudents: UnplacedStudentInfo[] } => {
    const studentMap = new Map(students.map(s => [s.id, s]));
    const units: Student[][] = [];
    const unplacedStudents: UnplacedStudentInfo[] = [];
    const visited = new Set<string>();

    for (const student of students) {
        if (visited.has(student.id)) continue;
        
        const clump = findClump(student, studentMap);
        clump.forEach(s => visited.add(s.id));
        units.push(clump);
    }
    
    const maxGroupSize = students.length > 0 ? Math.ceil(students.length / numGroups) : 0;
    const placeableUnits: Student[][] = [];

    for (const unit of units) {
         if (unit.length > maxGroupSize && maxGroupSize > 0) {
            const reason = `קבוצת "חייב להיות עם" (${unit.length} תלמידים) גדולה מדי ולא ניתן לשבצה באף קבוצה (גודל מקסימלי ${maxGroupSize}).`;
            unit.forEach(s => unplacedStudents.push({ name: s.name, id: s.id, reason }));
        } else {
            placeableUnits.push(unit);
        }
    }
    
    return { units: placeableUnits, unplacedStudents };
};

// Checks if adding a unit to a group creates a "dontSitWith" conflict.
const checkUnitConflict = (unit: Student[], groupStudents: Student[]): boolean => {
    for (const unitStudent of unit) {
        const uConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...unitStudent.constraints };
        const unitDontSitWithIds = uConstraints.dontSitWith || [];
        
        for (const groupStudent of groupStudents) {
            if (unitDontSitWithIds.includes(groupStudent.id)) return true;
            
            const gConstraints = { ...DEFAULT_STUDENT_CONSTRAINTS, ...groupStudent.constraints };
            const groupStudentDontSitWithIds = gConstraints.dontSitWith || [];
            if (groupStudentDontSitWithIds.includes(unitStudent.id)) return true;
        }
    }
    return false;
};

// A generic distribution helper that places units into the smallest valid group.
const distributeUnits = (
    units: Student[][], 
    students: Student[], 
    numGroups: number, 
    unplacedStudents: UnplacedStudentInfo[]
): { groupNumber: number, students: Student[] }[] => {
    
    const groups: { groupNumber: number, students: Student[] }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [] }));

    for (const unit of units) {
        let placed = false;
        const sortedGroups = [...groups].sort((a, b) => a.students.length - b.students.length);
        
        for (const group of sortedGroups) {
            if (!checkUnitConflict(unit, group.students)) {
                group.students.push(...unit);
                placed = true;
                break;
            }
        }

        if (!placed) {
            const reason = "לא נמצאה קבוצה מתאימה ללא התנגשות עם העדפות 'לא להיות בקבוצה עם'.";
            unit.forEach(s => unplacedStudents.push({ name: s.name, id: s.id, reason }));
        }
    }
    return groups;
};

const generateConstrainedGroups = (
    students: Student[],
    numGroups: number,
    groupingMethod: string
): GeneratedGroupsLayout => {
    const { units, unplacedStudents } = formPlacementUnits(students, numGroups);
    let finalGroups: { groupNumber: number, students: Student[], level?: number }[];

    if (groupingMethod === 'random') {
        const shuffledUnits = units.sort(() => Math.random() - 0.5);
        finalGroups = distributeUnits(shuffledUnits, students, numGroups, unplacedStudents);
    } 
    else if (groupingMethod === 'gender') {
        // Sort units to alternate between genders for better distribution
        const sortedUnits = units.sort((a, b) => {
            const getGenderScore = (u: Student[]) => u.reduce((acc, s) => acc + (s.gender === 'זכר' ? 1 : s.gender === 'נקבה' ? -1 : 0), 0);
            return getGenderScore(a) - getGenderScore(b);
        });
        finalGroups = distributeUnits(sortedUnits, students, numGroups, unplacedStudents);
    }
    else if (groupingMethod === 'separate_genders') {
        const boyUnits: Student[][] = [];
        const girlUnits: Student[][] = [];
        const otherUnits: Student[][] = [];

        for (const unit of units) {
            const genders = new Set(unit.map(s => s.gender).filter(Boolean));
            if (genders.size > 1) {
                const reason = "לא ניתן למלא בקשת 'חייב להיות עם' כי היא מערבבת בנים ובנות, ובחרת בשיטת חלוקה נפרדת.";
                unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
            } else if (genders.has('זכר')) {
                boyUnits.push(unit);
            } else if (genders.has('נקבה')) {
                girlUnits.push(unit);
            } else {
                otherUnits.push(unit);
            }
        }

        const totalBoys = boyUnits.flat().length;
        const totalGirls = girlUnits.flat().length;
        const totalGendered = totalBoys + totalGirls;

        let numBoyGroups = 0;
        let numGirlGroups = 0;

        if (totalGendered > 0) {
            numBoyGroups = Math.round(numGroups * (totalBoys / totalGendered));
            numGirlGroups = numGroups - numBoyGroups;

            if (totalBoys > 0 && numBoyGroups === 0 && numGroups > numGirlGroups) {
                numBoyGroups = 1;
                numGirlGroups = Math.max(0, numGroups - 1);
            }
            if (totalGirls > 0 && numGirlGroups === 0 && numGroups > numBoyGroups) {
                numGirlGroups = 1;
                numBoyGroups = Math.max(0, numGroups - 1);
            }
            if (totalBoys > 0 && totalGirls === 0) numBoyGroups = numGroups;
            if (totalGirls > 0 && totalBoys === 0) {
                 numGirlGroups = numGroups;
                 numBoyGroups = 0;
            }
        }

        let boyGroupsResult: { groupNumber: number, students: Student[] }[] = [];
        if (numBoyGroups > 0 && boyUnits.length > 0) {
            boyGroupsResult = distributeUnits(boyUnits.sort(() => Math.random() - 0.5), students, numBoyGroups, unplacedStudents);
        } else if (boyUnits.length > 0) {
            const reason = "אין מספיק קבוצות פנויות כדי ליצור קבוצה נפרדת לבנים.";
            boyUnits.flat().forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
        }

        let girlGroupsResult: { groupNumber: number, students: Student[] }[] = [];
        if (numGirlGroups > 0 && girlUnits.length > 0) {
            girlGroupsResult = distributeUnits(girlUnits.sort(() => Math.random() - 0.5), students, numGirlGroups, unplacedStudents);
        } else if (girlUnits.length > 0) {
            const reason = "אין מספיק קבוצות פנויות כדי ליצור קבוצה נפרדת לבנות.";
            girlUnits.flat().forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
        }

        const combinedGroups = [
            ...boyGroupsResult,
            ...girlGroupsResult.map(g => ({ ...g, groupNumber: g.groupNumber + boyGroupsResult.length }))
        ];

        if (otherUnits.length > 0) {
            if (combinedGroups.length > 0) {
                for (const unit of otherUnits) {
                    let placed = false;
                    const sortedGroups = [...combinedGroups].sort((a, b) => a.students.length - b.students.length);
                    for (const group of sortedGroups) {
                         if (!checkUnitConflict(unit, group.students)) {
                             group.students.push(...unit);
                             placed = true;
                             break;
                         }
                    }
                    if (!placed) {
                        const reason = "לא נמצאה קבוצה מתאימה עבור תלמיד/ה ללא הגדרת מגדר.";
                        unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
                    }
                }
            } else if (numGroups > 0) {
                const otherGroups = distributeUnits(otherUnits, students, numGroups, unplacedStudents);
                combinedGroups.push(...otherGroups);
            } else {
                 const reason = "אין קבוצות פנויות לשבץ תלמידים ללא הגדרת מגדר.";
                 otherUnits.flat().forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
            }
        }

        finalGroups = combinedGroups;
    }
    else if (groupingMethod === 'same_level') {
        // --- START: ROBUST HOMOGENEOUS GROUPING ---
        // 1. Sort units by their average academic level (lowest to highest).
        const getUnitAvgRating = (u: Student[]) => u.length > 0 ? u.reduce((acc, s) => acc + (s.academicLevel ?? 3), 0) / u.length : 3;
        const sortedUnits = units.sort((a, b) => getUnitAvgRating(a) - getUnitAvgRating(b));
        
        // 2. Create the empty groups.
        const groups: { groupNumber: number, students: Student[] }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [] }));

        // 3. Distribute the sorted units into the groups to create homogeneous chunks.
        const totalStudents = students.length;
        let studentCount = 0;
        let groupIndex = 0;

        for (const unit of sortedUnits) {
            const targetGroup = groups[groupIndex];

            // Basic conflict check before adding.
            if (!checkUnitConflict(unit, targetGroup.students)) {
                targetGroup.students.push(...unit);
                studentCount += unit.length;
                
                // Move to the next group if the current one has its approximate share of students.
                // This ensures the groups are filled sequentially with homogeneously-leveled students.
                const threshold = Math.ceil((totalStudents / numGroups) * (groupIndex + 1));
                if (studentCount >= threshold && groupIndex < numGroups - 1) {
                    groupIndex++;
                }
            } else {
                 // Conflict found. This is a hard problem. For now, mark as unplaced.
                const reason = `התנגשות העדפות בקבוצה ההומוגנית (${targetGroup.groupNumber}).`;
                unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
            }
        }
        finalGroups = groups;
        // --- END: ROBUST HOMOGENEOUS GROUPING ---
    }
    else if (groupingMethod === 'heterogeneous') {
        // New greedy algorithm for more robust heterogeneous grouping
        const getUnitRating = (u: Student[]) => u.reduce((acc, s) => acc + (s.academicLevel ?? 3), 0);
        // Sort units from highest academic level to lowest
        const sortedUnits = units.sort((a, b) => getUnitRating(b) - getUnitRating(a));
        
        // Initialize groups with a total level counter
        const groups: { groupNumber: number, students: Student[], totalLevel: number }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [], totalLevel: 0 }));

        for (const unit of sortedUnits) {
            let placed = false;
            // Always try to place the unit in the group with the current lowest total academic level
            const sortedGroupsByLevel = [...groups].sort((a, b) => a.totalLevel - b.totalLevel);
            
            for (const targetGroup of sortedGroupsByLevel) {
                // Check for "don't sit with" conflicts
                if (!checkUnitConflict(unit, targetGroup.students)) {
                    // If no conflict, add the unit to this group
                    targetGroup.students.push(...unit);
                    targetGroup.totalLevel += getUnitRating(unit);
                    placed = true;
                    break; // Unit is placed, move to the next unit
                }
            }

           if (!placed) {
               const reason = "לא נמצאה קבוצה הטרוגנית מתאימה ללא התנגשות העדפות.";
               unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
           }
        }
        finalGroups = groups;
    }
    else if (groupingMethod === 'same_behavior') {
        // Homogeneous grouping by behavior
        const getUnitAvgRating = (u: Student[]) => u.length > 0 ? u.reduce((acc, s) => acc + (s.behaviorLevel ?? 3), 0) / u.length : 3;
        const sortedUnits = units.sort((a, b) => getUnitAvgRating(a) - getUnitAvgRating(b));
        
        const groups: { groupNumber: number, students: Student[] }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [] }));

        const totalStudents = students.length;
        let studentCount = 0;
        let groupIndex = 0;

        for (const unit of sortedUnits) {
            const targetGroup = groups[groupIndex];

            if (!checkUnitConflict(unit, targetGroup.students)) {
                targetGroup.students.push(...unit);
                studentCount += unit.length;
                
                const threshold = Math.ceil((totalStudents / numGroups) * (groupIndex + 1));
                if (studentCount >= threshold && groupIndex < numGroups - 1) {
                    groupIndex++;
                }
            } else {
                const reason = `התנגשות העדפות בקבוצה ההומוגנית (התנהגות) (${targetGroup.groupNumber}).`;
                unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
            }
        }
        finalGroups = groups;
    }
    else if (groupingMethod === 'heterogeneous_behavior') {
        // Heterogeneous grouping by behavior
        const getUnitRating = (u: Student[]) => u.reduce((acc, s) => acc + (s.behaviorLevel ?? 3), 0);
        const sortedUnits = units.sort((a, b) => getUnitRating(b) - getUnitRating(a));
        
        const groups: { groupNumber: number, students: Student[], totalLevel: number }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [], totalLevel: 0 }));

        for (const unit of sortedUnits) {
            let placed = false;
            const sortedGroupsByLevel = [...groups].sort((a, b) => a.totalLevel - b.totalLevel);
            
            for (const targetGroup of sortedGroupsByLevel) {
                if (!checkUnitConflict(unit, targetGroup.students)) {
                    targetGroup.students.push(...unit);
                    targetGroup.totalLevel += getUnitRating(unit);
                    placed = true;
                    break;
                }
            }

           if (!placed) {
               const reason = "לא נמצאה קבוצה הטרוגנית (התנהגות) מתאימה ללא התנגשות העדפות.";
               unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
           }
        }
        finalGroups = groups;
    }
    else if (groupingMethod === 'heterogeneous_combined') {
        // Heterogeneous grouping by combined academic and behavior levels
        const getUnitRating = (u: Student[]) => u.reduce((acc, s) => acc + ((s.academicLevel ?? 3) + (s.behaviorLevel ?? 3)), 0);
        const sortedUnits = units.sort((a, b) => getUnitRating(b) - getUnitRating(a));
        
        const groups: { groupNumber: number, students: Student[], totalLevel: number }[] = Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [], totalLevel: 0 }));

        for (const unit of sortedUnits) {
            let placed = false;
            const sortedGroupsByLevel = [...groups].sort((a, b) => a.totalLevel - b.totalLevel);
            
            for (const targetGroup of sortedGroupsByLevel) {
                if (!checkUnitConflict(unit, targetGroup.students)) {
                    targetGroup.students.push(...unit);
                    targetGroup.totalLevel += getUnitRating(unit);
                    placed = true;
                    break;
                }
            }

           if (!placed) {
               const reason = "לא נמצאה קבוצה הטרוגנית (משולבת) מתאימה ללא התנגשות העדפות.";
               unit.forEach(s => unplacedStudents.push({ id: s.id, name: s.name, reason }));
           }
        }
        finalGroups = groups;
    }
    else {
        // Fallback to random
        const shuffledUnits = units.sort(() => Math.random() - 0.5);
        finalGroups = distributeUnits(shuffledUnits, students, numGroups, unplacedStudents);
    }
    
    return {
        groups: finalGroups.map(g => ({ ...g, students: g.students.map(s => s.name) })),
        unplacedStudents
    };
};


const generateManualGroupsLayout = (chart: Chart, groupingMethod: string): GeneratedGroupsLayout => {
    const { layoutDetails, students } = chart;
    const { groups: numGroups } = layoutDetails as { groups: number };
    
    if (students.length === 0 || numGroups <= 0) {
        return { groups: Array.from({ length: numGroups }, (_, i) => ({ groupNumber: i + 1, students: [] })), unplacedStudents: [] };
    }
    
    let effectiveGroupingMethod = groupingMethod;
    if (groupingMethod === 'same_level' || groupingMethod === 'heterogeneous') {
        const hasAcademicLevels = students.some(s => s.academicLevel !== undefined && s.academicLevel > 0);
        if (!hasAcademicLevels) {
            effectiveGroupingMethod = 'random'; // Fallback to random if no academic levels are set
        }
    }
    if (groupingMethod === 'same_behavior' || groupingMethod === 'heterogeneous_behavior') {
        const hasBehaviorLevels = students.some(s => s.behaviorLevel !== undefined && s.behaviorLevel > 0);
        if (!hasBehaviorLevels) {
            effectiveGroupingMethod = 'random'; // Fallback to random if no behavior levels are set
        }
    }
    if (groupingMethod === 'heterogeneous_combined') {
        const hasLevels = students.some(s => (s.academicLevel !== undefined && s.academicLevel > 0) || (s.behaviorLevel !== undefined && s.behaviorLevel > 0));
        if (!hasLevels) {
            effectiveGroupingMethod = 'random';
        }
    }
    
    return generateConstrainedGroups(students, numGroups, effectiveGroupingMethod);
};

// --- END: NEW GROUP GENERATION LOGIC ---

export const generateLayout = (chart: Chart, groupingMethod: string) => {
    if (chart.layoutType === 'rows') {
        return generateManualRowsLayout(chart);
    } else {
        return generateManualGroupsLayout(chart, groupingMethod);
    }
};